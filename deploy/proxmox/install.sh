#!/usr/bin/env bash
# Creates a Fly Ash Bricks LXC container on a Proxmox VE host. Run in the
# host's shell (Datacenter → node → Shell) as root:
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/neosharks/flyashbricks/main/deploy/proxmox/install.sh)"
#
# Asks a few questions (Enter keeps the default), creates a small unprivileged
# Ubuntu 24.04 container, and runs deploy/proxmox/setup.sh inside it: Node.js
# and MongoDB as system services plus the newest ready-built release — no
# Docker. The app is meant to be reached through a Cloudflare Tunnel.
# Every question can be answered ahead of time with an environment variable
# of the same name, e.g. `CTID=120 APP_URL=https://bricks.example.com bash -c ...`.
set -euo pipefail

REPO=${REPO:-neosharks/flyashbricks}
RAW_BASE=${RAW_BASE:-https://raw.githubusercontent.com/$REPO/main}

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

# ask_secret VAR "Question" — like ask, without echoing what is typed.
ask_secret() {
  local var=$1 question=$2 answer=''
  if [[ -n "${!var+x}" ]]; then
    return
  fi
  if [[ -t 0 ]]; then
    read -rsp "$question: " answer
    echo
  fi
  printf -v "$var" '%s' "$answer"
}

# The preferred storage unless it is over 85% full (a thin pool refuses new
# disks well before 100%); otherwise the one with the most space free.
first_storage() {
  local content=$1 preferred=$2
  pvesm status -content "$content" 2>/dev/null | awk -v want="$preferred" '
    NR > 1 && $3 == "active" && $7 + 0 < 85 {
      if ($1 == want) { print $1; found = 1; exit }
      if ($6 + 0 > best) { best = $6 + 0; name = $1 }
    }
    END { if (!found && name != "") print name }'
}

# MongoDB publishes server packages for Ubuntu 24.04 on both architectures.
latest_template() {
  pveam available --section system | awk '{print $2}' |
    grep -E '^ubuntu-24\.04-standard_.*\.tar\.zst$' | sort -V | tail -n1
}

[[ $EUID -eq 0 ]] || die 'Run as root on the Proxmox host.'
command -v pct >/dev/null 2>&1 || die 'pct not found: run this on a Proxmox VE host, not inside a VM or container.'
if [[ "$(uname -m)" == x86_64 ]]; then
  grep -qw avx /proc/cpuinfo || die 'This CPU has no AVX, which MongoDB 8 requires.'
fi

echo
echo 'Fly Ash Bricks — Proxmox installer'
echo '----------------------------------'
echo 'Container'
ask CTID '  Container ID' "$(pvesh get /cluster/nextid)"
ask CT_HOSTNAME '  Hostname' flyashbricks
ask CT_CORES '  CPU cores' 2
ask CT_RAM '  Memory (MB)' 1536
ask CT_DISK '  Disk (GB)' 8
ask CT_STORAGE '  Disk storage' "$(first_storage rootdir local-lvm)"
ask CT_BRIDGE '  Network bridge' vmbr0
ask CT_IP '  IPv4 address, CIDR (e.g. 192.168.1.50/24) or dhcp' dhcp
if [[ "$CT_IP" != dhcp ]]; then
  ask CT_GW '  Gateway' ''
fi
echo
echo 'App'
echo '  Public address: the https:// hostname your Cloudflare Tunnel serves,'
echo '  e.g. https://bricks.example.com.'
ask APP_URL '  Public address' ''
[[ "$APP_URL" =~ ^https:// ]] || die 'The public address must start with https://.'
echo '  Tunnel token: from Cloudflare Zero Trust → Networks → Tunnels → your tunnel'
echo '  (the long value starting with eyJ). The connector is then set up inside the'
echo '  container. Leave empty to run cloudflared somewhere else.'
ask_secret CF_TUNNEL_TOKEN '  Tunnel token (hidden)'
[[ -z "$CF_TUNNEL_TOKEN" || "$CF_TUNNEL_TOKEN" == eyJ* ]] ||
  die 'A tunnel token starts with eyJ; copy only that part of the command Cloudflare shows.'
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
[[ -n "$CT_STORAGE" ]] ||
  die "No storage with room accepts container disks. To use the root disk: pvesm set local --content iso,vztmpl,backup,rootdir"

TEMPLATE_STORAGE=${TEMPLATE_STORAGE:-$(first_storage vztmpl local)}
[[ -n "$TEMPLATE_STORAGE" ]] || die 'No storage accepts container templates.'
log 'Updating the template list'
pveam update >/dev/null
TEMPLATE=$(latest_template)
[[ -n "$TEMPLATE" ]] || die 'No Ubuntu 24.04 template is available.'
if ! pveam list "$TEMPLATE_STORAGE" | grep -q "$TEMPLATE"; then
  log "Downloading $TEMPLATE"
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE" >/dev/null
fi

net="name=eth0,bridge=$CT_BRIDGE,ip=$CT_IP"
[[ -n "${CT_GW:-}" ]] && net+=",gw=$CT_GW"

# Proxmox gives the container the host's DNS servers. Tailscale's MagicDNS
# (100.100.100.100) only answers on the tailnet, which the container is not
# on, so use public resolvers then. CT_DNS overrides either way.
if [[ -z "${CT_DNS:-}" ]] && grep -qE '^nameserver (100\.100\.100\.100|fd7a:115c:a1e0::53)' /etc/resolv.conf; then
  CT_DNS='1.1.1.1 8.8.8.8'
fi
dns=()
[[ -n "${CT_DNS:-}" ]] && dns=(--nameserver "$CT_DNS" --searchdomain local)

log "Creating container $CTID ($CT_HOSTNAME)"
# Unprivileged; nesting lets systemd in Ubuntu 24.04 run its services normally.
pct create "$CTID" "$TEMPLATE_STORAGE:vztmpl/$TEMPLATE" \
  --hostname "$CT_HOSTNAME" \
  --cores "$CT_CORES" \
  --memory "$CT_RAM" \
  --swap 512 \
  --rootfs "$CT_STORAGE:$CT_DISK" \
  --net0 "$net" "${dns[@]}" \
  --ostype ubuntu \
  --unprivileged 1 \
  --features nesting=1 \
  --onboot 1 \
  --tags flyashbricks \
  --description "Fly Ash Bricks — update with: pct exec $CTID -- flyashbricks update" >/dev/null
pct start "$CTID"

# A name lookup with no reachable DNS server can hang; bound every try.
resolves() { pct exec "$CTID" -- timeout 5 getent hosts github.com >/dev/null 2>&1; }
log 'Waiting for the network'
for _ in $(seq 1 24); do
  resolves && break
  sleep 2
done
if ! resolves; then
  pct exec "$CTID" -- ping -c 1 -W 3 1.1.1.1 >/dev/null 2>&1 ||
    die "Container $CTID cannot reach the internet; check the bridge, IP and gateway."
  die "Container $CTID is online but cannot look up names. Set DNS servers, e.g. CT_DNS='1.1.1.1 8.8.8.8', and run this again."
fi

workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
curl -fsSL "$RAW_BASE/deploy/proxmox/setup.sh" -o "$workdir/setup.sh"
# %q quotes each value so names with spaces survive being sourced.
for var in REPO APP_URL CF_TUNNEL_TOKEN ORG_NAME ADMIN_NAME ADMIN_PHONE ADMIN_EMAIL; do
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
