#!/usr/bin/env bash
# Creates a Fly Ash Bricks LXC container on a Proxmox VE host. Run in the
# host's shell (Datacenter → node → Shell) as root:
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/neosharks/flyashbricks/main/deploy/proxmox/install.sh)"
#
# Asks a few questions (Enter keeps the default), creates an unprivileged
# Debian container with Docker, and runs deploy/proxmox/setup.sh inside it.
# Every question can be answered ahead of time with an environment variable
# of the same name, e.g. `CTID=120 CT_IP=192.168.1.50/24 CT_GW=192.168.1.1 bash -c ...`.
set -euo pipefail

REPO_URL=${REPO_URL:-https://github.com/neosharks/flyashbricks.git}
BRANCH=${BRANCH:-main}
RAW_BASE=${RAW_BASE:-https://raw.githubusercontent.com/neosharks/flyashbricks/$BRANCH}

log() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
die() {
  printf '\033[1;31mError:\033[0m %s\n' "$*" >&2
  exit 1
}

# ask VAR "Question" default — keeps VAR when already set; otherwise prompts
# on a terminal, or takes the default without one.
ask() {
  local var=$1 question=$2 default=${3:-} answer
  if [[ -n "${!var+x}" ]]; then
    return
  fi
  if [[ -t 0 ]]; then
    read -rp "$question [${default}]: " answer
  fi
  printf -v "$var" '%s' "${answer:-$default}"
}

first_storage() {
  local content=$1 preferred=$2
  local all
  all=$(pvesm status -content "$content" 2>/dev/null | awk 'NR > 1 && $3 == "active" {print $1}')
  if grep -qx "$preferred" <<<"$all"; then
    echo "$preferred"
  else
    head -n1 <<<"$all"
  fi
}

latest_template() {
  pveam available --section system | awk '{print $2}' |
    grep -E '^debian-1[23]-standard_.*_amd64\.tar\.zst$' | sort -V | tail -n1
}

[[ $EUID -eq 0 ]] || die 'Run as root on the Proxmox host.'
command -v pct >/dev/null 2>&1 || die 'pct not found: run this on a Proxmox VE host, not inside a VM or container.'
grep -qw avx /proc/cpuinfo || die 'This CPU has no AVX, which MongoDB 8 requires.'

echo
echo 'Fly Ash Bricks — Proxmox installer'
echo '----------------------------------'
echo 'Container'
ask CTID '  Container ID' "$(pvesh get /cluster/nextid)"
ask CT_HOSTNAME '  Hostname' flyashbricks
ask CT_CORES '  CPU cores' 2
ask CT_RAM '  Memory (MB)' 4096
ask CT_DISK '  Disk (GB)' 20
ask CT_STORAGE '  Disk storage' "$(first_storage rootdir local-lvm)"
ask CT_BRIDGE '  Network bridge' vmbr0
ask CT_IP '  IPv4 address, CIDR (e.g. 192.168.1.50/24) or dhcp' dhcp
if [[ "$CT_IP" != dhcp ]]; then
  ask CT_GW '  Gateway' ''
fi
echo
echo 'App'
echo '  Domain: leave empty to use the container IP on your LAN (browsers will'
echo '  warn until you trust its certificate). A real domain must already point'
echo '  at this network with ports 80/443 forwarded to the container.'
ask APP_DOMAIN '  Domain' ''
ask ORG_NAME '  Company name (empty to skip)' ''
if [[ -n "$ORG_NAME" ]]; then
  ask ADMIN_NAME '  Owner name' ''
  ask ADMIN_PHONE '  Owner mobile number' ''
  ask ADMIN_EMAIL '  Owner email (optional)' ''
  [[ -n "$ADMIN_NAME" && -n "$ADMIN_PHONE" ]] || die 'Owner name and mobile number are required with a company name.'
fi
echo

[[ "$CTID" =~ ^[0-9]+$ ]] || die "Container ID must be a number, got '$CTID'."
pct status "$CTID" >/dev/null 2>&1 && die "Container $CTID already exists."
[[ -n "$CT_STORAGE" ]] || die 'No storage accepts container disks; create one in Datacenter → Storage.'

TEMPLATE_STORAGE=${TEMPLATE_STORAGE:-$(first_storage vztmpl local)}
[[ -n "$TEMPLATE_STORAGE" ]] || die 'No storage accepts container templates.'
log 'Updating the template list'
pveam update >/dev/null
TEMPLATE=$(latest_template)
[[ -n "$TEMPLATE" ]] || die 'No Debian 12/13 template is available.'
if ! pveam list "$TEMPLATE_STORAGE" | grep -q "$TEMPLATE"; then
  log "Downloading $TEMPLATE"
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE" >/dev/null
fi

net="name=eth0,bridge=$CT_BRIDGE,ip=$CT_IP"
[[ -n "${CT_GW:-}" ]] && net+=",gw=$CT_GW"

log "Creating container $CTID ($CT_HOSTNAME)"
# Unprivileged, with nesting and keyctl so Docker can run inside it.
pct create "$CTID" "$TEMPLATE_STORAGE:vztmpl/$TEMPLATE" \
  --hostname "$CT_HOSTNAME" \
  --cores "$CT_CORES" \
  --memory "$CT_RAM" \
  --swap 2048 \
  --rootfs "$CT_STORAGE:$CT_DISK" \
  --net0 "$net" \
  --ostype debian \
  --unprivileged 1 \
  --features nesting=1,keyctl=1 \
  --onboot 1 \
  --tags flyashbricks \
  --description "Fly Ash Bricks — update with: pct exec $CTID -- flyashbricks update" >/dev/null
pct start "$CTID"

log 'Waiting for the network'
for _ in $(seq 1 60); do
  pct exec "$CTID" -- getent hosts github.com >/dev/null 2>&1 && break
  sleep 2
done
pct exec "$CTID" -- getent hosts github.com >/dev/null 2>&1 ||
  die "Container $CTID has no internet access; check the bridge, IP and gateway."

workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
curl -fsSL "$RAW_BASE/deploy/proxmox/setup.sh" -o "$workdir/setup.sh"
# %q quotes each value so names with spaces survive being sourced.
for var in REPO_URL BRANCH APP_DOMAIN ORG_NAME ADMIN_NAME ADMIN_PHONE ADMIN_EMAIL; do
  printf '%s=%q\n' "$var" "${!var:-}"
done >"$workdir/answers.env"
pct push "$CTID" "$workdir/answers.env" /root/flyashbricks-install.env --perms 600
pct push "$CTID" "$workdir/setup.sh" /root/flyashbricks-setup.sh --perms 700

log 'Installing inside the container'
pct exec "$CTID" -- bash /root/flyashbricks-setup.sh install
pct exec "$CTID" -- rm -f /root/flyashbricks-setup.sh

cat <<EOF

Container $CTID is ready and starts with the host.
  Shell:   pct enter $CTID
  Update:  pct exec $CTID -- flyashbricks update
EOF
