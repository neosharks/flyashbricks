#!/usr/bin/env bash
# Installs or updates Fly Ash Bricks on one Ubuntu 24.04 machine, without
# Docker: Node.js and MongoDB run as ordinary system services, and the app is
# a ready-built release downloaded from GitHub — nothing is compiled here.
# deploy/proxmox/install.sh runs it inside the LXC it creates; on any other
# Ubuntu 24.04 server or VM run it as root:
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/neosharks/flyashbricks/main/deploy/proxmox/setup.sh)" setup install
#
# It is linked to /usr/local/bin/flyashbricks:
#
#   flyashbricks update               # newest release
#   flyashbricks update v0.3.0        # a specific one
#   flyashbricks run create-organization --org "X" --name "Y" --phone 98…
#   flyashbricks run backup-restore --file backup.fabk
#
# The app is reached through a Cloudflare Tunnel (or another HTTPS proxy)
# pointed at http://<this machine>:3000; it does not terminate HTTPS itself.
#
# Settings for `install` come from the environment, or from
# /root/flyashbricks-install.env when install.sh pushed one:
#   APP_URL         the public https:// address, e.g. https://bricks.example.com
#   ORG_NAME, ADMIN_NAME, ADMIN_PHONE, ADMIN_EMAIL
#                   first company and its admin; skipped when ORG_NAME is empty
#   SMTP_URL, MAIL_FROM
#                   real email; without SMTP_URL mail is written to the log
#   REPO            GitHub repository releases come from
#   RELEASE_FILE    install this local release archive instead of downloading
#
# Layout:
#   /opt/flyashbricks/releases/vX.Y.Z   unpacked releases (the last two kept)
#   /opt/flyashbricks/current           the running one
#   /etc/flyashbricks/env               settings and secrets, made once
#   /var/lib/flyashbricks               uploads, backups, updater folder
set -euo pipefail

REPO=${REPO:-neosharks/flyashbricks}
BASE=/opt/flyashbricks
RELEASES=$BASE/releases
CURRENT=$BASE/current
NODE_DIR=/opt/node
CONFIG_DIR=/etc/flyashbricks
CONFIG=$CONFIG_DIR/env
DATA=/var/lib/flyashbricks
UPDATER_DIR=$DATA/updater
APP_USER=flyashbricks
PORT=3000
MONGO_SERIES=8.2
# MongoDB signs every 8.x series with the 8.0 key.
MONGO_KEY=8.0
ANSWERS_FILE=${ANSWERS_FILE:-/root/flyashbricks-install.env}
RELEASE_TAG='^v[0-9]+\.[0-9]+\.[0-9]+$'

log() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
die() {
  printf '\033[1;31mError:\033[0m %s\n' "$*" >&2
  exit 1
}

require_root() { [[ $EUID -eq 0 ]] || die 'Run as root.'; }

arch() {
  case "$(uname -m)" in
    x86_64) echo x64 ;;
    aarch64) echo arm64 ;;
    *) die "Unsupported architecture: $(uname -m)" ;;
  esac
}

primary_ip() {
  hostname -I | awk '{print $1}'
}

running_version() {
  if [[ -L "$CURRENT" ]]; then basename "$(readlink -f "$CURRENT")"; else echo none; fi
}

# Newest published release, from the redirect GitHub answers /releases/latest
# with — no API token or rate limit involved.
latest_release() {
  curl -fsSI "https://github.com/$REPO/releases/latest" |
    sed -n 's#^[Ll]ocation: .*/releases/tag/\(v[0-9.]*\)[[:space:]]*$#\1#p' |
    grep -E "$RELEASE_TAG" | head -n1 || true
}

install_packages() {
  log 'Installing base packages'
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg openssl tar xz-utils >/dev/null
}

# Node.js from nodejs.org, checked against its published SHA-256 list.
ensure_node() {
  local major=$1 current='' sums tarball work
  if [[ -x "$NODE_DIR/bin/node" ]]; then
    current=$("$NODE_DIR/bin/node" -p 'process.versions.node.split(".")[0]')
  fi
  [[ "$current" == "$major" ]] && return 0
  log "Installing Node.js $major"
  sums=$(curl -fsSL "https://nodejs.org/dist/latest-v$major.x/SHASUMS256.txt")
  tarball=$(awk -v suffix="linux-$(arch).tar.xz" 'index($2, suffix) {print $2}' <<<"$sums" | head -n1)
  [[ -n "$tarball" ]] || die "No Node.js $major build for linux-$(arch)"
  work=$(mktemp -d)
  curl -fsSL "https://nodejs.org/dist/latest-v$major.x/$tarball" -o "$work/$tarball"
  (cd "$work" && grep " $tarball\$" <<<"$sums" | sha256sum -c --quiet -) ||
    die 'Node.js download failed its checksum'
  rm -rf "$NODE_DIR.new"
  mkdir -p "$NODE_DIR.new"
  tar -xJf "$work/$tarball" -C "$NODE_DIR.new" --strip-components=1
  rm -rf "$NODE_DIR" "$work"
  mv "$NODE_DIR.new" "$NODE_DIR"
}

ensure_user_and_dirs() {
  id "$APP_USER" >/dev/null 2>&1 ||
    useradd --system --home-dir "$DATA" --no-create-home --shell /usr/sbin/nologin "$APP_USER"
  install -d -m 0755 "$BASE" "$RELEASES"
  install -d -m 0750 -o root -g "$APP_USER" "$CONFIG_DIR"
  install -d -m 0750 -o "$APP_USER" -g "$APP_USER" "$DATA" "$DATA/assets" "$DATA/backups"
  install -d -m 0755 -o "$APP_USER" -g "$APP_USER" "$UPDATER_DIR"
  printf '{"installed":true}\n' >"$UPDATER_DIR/agent.json"
  chmod 644 "$UPDATER_DIR/agent.json"
}

# MongoDB as a one-member replica set (the app uses transactions), listening
# on localhost only, with authentication and a small cache.
ensure_mongodb() {
  # shellcheck source=/dev/null
  source /etc/os-release
  [[ "$ID" == ubuntu ]] || die "MongoDB publishes server packages for Ubuntu here; this is $PRETTY_NAME."
  if ! command -v mongod >/dev/null 2>&1; then
    log "Installing MongoDB $MONGO_SERIES"
    curl -fsSL "https://pgp.mongodb.com/server-$MONGO_KEY.asc" |
      gpg --dearmor --yes -o "/usr/share/keyrings/mongodb-server-$MONGO_KEY.gpg"
    echo "deb [signed-by=/usr/share/keyrings/mongodb-server-$MONGO_KEY.gpg] https://repo.mongodb.org/apt/ubuntu $VERSION_CODENAME/mongodb-org/$MONGO_SERIES multiverse" \
      >"/etc/apt/sources.list.d/mongodb-org-$MONGO_SERIES.list"
    apt-get update -qq
    apt-get install -y -qq mongodb-org-server mongodb-mongosh >/dev/null
  fi

  if [[ ! -f /etc/mongod.key ]]; then
    openssl rand -base64 756 >/etc/mongod.key
    chown mongodb:mongodb /etc/mongod.key
    chmod 400 /etc/mongod.key
  fi
  cat >/etc/mongod.conf <<'EOF'
# Written by Fly Ash Bricks setup.sh.
storage:
  dbPath: /var/lib/mongodb
  wiredTiger:
    engineConfig:
      cacheSizeGB: 0.25
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1
replication:
  replSetName: rs0
security:
  authorization: enabled
  keyFile: /etc/mongod.key
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
EOF
  systemctl enable mongod >/dev/null 2>&1
  systemctl restart mongod

  local _
  for _ in $(seq 1 30); do
    mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' >/dev/null 2>&1 && break
    sleep 1
  done

  # The localhost exception allows exactly this on a fresh database: start the
  # replica set, then create the first user. Afterwards it closes for good.
  if [[ ! -f "$CONFIG_DIR/mongo-root" ]]; then
    log 'Initialising the database'
    local root_password app_password
    root_password=$(openssl rand -hex 32)
    app_password=$(openssl rand -hex 32)
    mongosh --quiet --eval "try { rs.status() } catch (e) { rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] }) }" >/dev/null
    for _ in $(seq 1 30); do
      [[ "$(mongosh --quiet --eval 'db.hello().isWritablePrimary' 2>/dev/null)" == true ]] && break
      sleep 1
    done
    mongosh --quiet admin --eval "db.createUser({ user: 'root', pwd: '$root_password', roles: ['root'] })" >/dev/null
    mongosh --quiet -u root -p "$root_password" --authenticationDatabase admin admin \
      --eval "db.createUser({ user: 'flyash_app', pwd: '$app_password', roles: [{ role: 'readWrite', db: 'flyash' }] })" >/dev/null
    (
      umask 077
      printf 'root:%s\n' "$root_password" >"$CONFIG_DIR/mongo-root"
      printf '%s\n' "$app_password" >"$CONFIG_DIR/.mongo-app"
    )
  fi
}

# Every value is double-quoted: systemd, Node's --env-file and bash all read
# that the same way. Secrets are hex or base64, which need no escaping.
write_config() {
  if [[ -f "$CONFIG" ]]; then
    log "Keeping existing $CONFIG"
    return 0
  fi
  local url=${APP_URL:-}
  [[ "$url" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?/?$ ]] ||
    die "APP_URL must be the public https:// address the tunnel serves, got '$url'."
  url=${url%/}
  local host=${url#https://}
  host=${host%%:*}
  local mail_transport=console
  [[ -n "${SMTP_URL:-}" ]] && mail_transport=smtp
  local app_password
  app_password=$(cat "$CONFIG_DIR/.mongo-app")

  log "Writing $CONFIG"
  (
    umask 027
    cat >"$CONFIG" <<EOF
# Fly Ash Bricks settings, written by setup.sh on $(date -Iseconds).
# After editing: systemctl restart flyashbricks
NODE_ENV="production"
PORT="$PORT"
HOSTNAME="0.0.0.0"
APP_URL="$url"
AUTH_URL="$url"
AUTH_TRUST_HOST="true"
NEXT_PUBLIC_APP_NAME="Fly Ash Bricks"
AUTH_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
CRON_SECRET="$(openssl rand -base64 48 | tr -d '\n')"

MONGODB_URI="mongodb://flyash_app:$app_password@127.0.0.1:27017/flyash?replicaSet=rs0&authSource=admin"
MONGODB_DB_NAME="flyash"

# Cloudflare writes the visitor's address here; see docs/security.md.
CLIENT_IP_HEADER="cf-connecting-ip"
LOG_LEVEL="info"

MAIL_TRANSPORT="$mail_transport"
MAIL_FROM="${MAIL_FROM:-alerts@$host}"
SMTP_URL="${SMTP_URL:-}"

STORAGE_DIR="$DATA/assets"
BACKUP_DIR="$DATA/backups"
# 16+ characters, kept in a password manager, turns on nightly encrypted backups.
BACKUP_PASSPHRASE=""
BACKUP_RETENTION_DAYS="30"
BACKUP_EMAIL_TO=""

SMS_PROVIDER="none"
WHATSAPP_PROVIDER="none"

UPDATE_REPO="$REPO"
UPDATER_DIR="$UPDATER_DIR"
EOF
  )
  chgrp "$APP_USER" "$CONFIG"
  rm -f "$CONFIG_DIR/.mongo-app"
}

# Unpacks release $1 into $RELEASES, from RELEASE_FILE or GitHub, after
# checking its SHA-256.
fetch_release() {
  local version=$1 name work
  name=flyashbricks-$version-linux-$(arch)
  [[ -d "$RELEASES/$version" ]] && return 0
  work=$(mktemp -d)
  if [[ -n "${RELEASE_FILE:-}" ]]; then
    log "Using $RELEASE_FILE"
    cp "$RELEASE_FILE" "$work/$name.tar.gz"
    [[ -f "$RELEASE_FILE.sha256" ]] && cp "$RELEASE_FILE.sha256" "$work/$name.tar.gz.sha256"
  else
    log "Downloading $version"
    local url=https://github.com/$REPO/releases/download/$version
    curl -fsSL "$url/$name.tar.gz" -o "$work/$name.tar.gz"
    curl -fsSL "$url/$name.tar.gz.sha256" -o "$work/$name.tar.gz.sha256"
  fi
  if [[ -f "$work/$name.tar.gz.sha256" ]]; then
    (cd "$work" && sha256sum -c --quiet "$name.tar.gz.sha256") || die "$name failed its checksum"
  elif [[ -z "${RELEASE_FILE:-}" ]]; then
    die "$name has no checksum file"
  fi
  tar -xzf "$work/$name.tar.gz" -C "$work"
  mv "$work/$name" "$RELEASES/$version"
  rm -rf "$work"
}

install_units() {
  cat >/etc/systemd/system/flyashbricks.service <<EOF
[Unit]
Description=Fly Ash Bricks
After=network-online.target mongod.service
Wants=network-online.target
Requires=mongod.service

[Service]
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$CURRENT/app
EnvironmentFile=$CONFIG
EnvironmentFile=$CURRENT/release.env
# Heap below MemoryMax so Node collects instead of being killed.
ExecStart=$NODE_DIR/bin/node --enable-source-maps --max-old-space-size=384 server.js
Restart=on-failure
RestartSec=3
MemoryMax=640M
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA
CapabilityBoundingSet=
SystemCallArchitectures=native

[Install]
WantedBy=multi-user.target
EOF

  # Scheduled jobs: the app's /api/cron endpoints, called on this machine.
  cat >/etc/systemd/system/flyashbricks-cron@.service <<EOF
[Unit]
Description=Fly Ash Bricks scheduled job %i
After=flyashbricks.service

[Service]
Type=oneshot
EnvironmentFile=$CONFIG
ExecStart=/usr/bin/curl -fsS -m 300 -o /dev/null -X POST -H "Authorization: Bearer \${CRON_SECRET}" http://127.0.0.1:$PORT/api/cron/%i
EOF
  write_timer outbox 'minutely' 'send queued notifications'
  write_timer backup '*-*-* 02:30:00 Asia/Kolkata' 'nightly backup (when a passphrase is set)'
  write_timer reminders '*-*-* 09:00:00 Asia/Kolkata' 'daily reminders'
  write_timer cleanup '*-*-* 09:05:00 Asia/Kolkata' 'daily housekeeping'

  # The Updates page: the app leaves a request, this runs it as root.
  cat >/etc/systemd/system/flyashbricks-updater.path <<EOF
[Unit]
Description=Watch for update requests from Fly Ash Bricks

[Path]
PathExists=$UPDATER_DIR/request.json
Unit=flyashbricks-updater.service

[Install]
WantedBy=multi-user.target
EOF
  cat >/etc/systemd/system/flyashbricks-updater.service <<EOF
[Unit]
Description=Install the Fly Ash Bricks release requested from the app

[Service]
Type=oneshot
ExecStart=/usr/local/bin/flyashbricks apply-request
EOF

  systemctl daemon-reload
  systemctl enable flyashbricks.service >/dev/null 2>&1
  systemctl enable --now flyashbricks-updater.path >/dev/null 2>&1
  local job
  for job in outbox backup reminders cleanup; do
    systemctl enable --now "flyashbricks-$job.timer" >/dev/null 2>&1
  done
}

write_timer() {
  cat >"/etc/systemd/system/flyashbricks-$1.timer" <<EOF
[Unit]
Description=Fly Ash Bricks: $3

[Timer]
OnCalendar=$2
Persistent=true
Unit=flyashbricks-cron@$1.service

[Install]
WantedBy=timers.target
EOF
}

# node_in RELEASE_DIR SCRIPT ARGS… — an admin script of a release, as the app
# user, with the app's settings.
node_in() {
  local dir=$1 script=$2
  shift 2
  [[ -f "$dir/scripts/$script.mjs" ]] || die "No such script: $script"
  (cd "$dir/scripts" && runuser -u "$APP_USER" -- "$NODE_DIR/bin/node" \
    --env-file="$CONFIG" --env-file="$dir/release.env" "$script.mjs" "$@")
}

wait_until_ready() {
  local _
  for _ in $(seq 1 60); do
    curl -fs -m 3 -o /dev/null "http://127.0.0.1:$PORT/api/readyz" && return 0
    sleep 1
  done
  return 1
}

# Points `current` at release $1 in one rename, so it is never half switched.
switch_to() {
  ln -sfn "$RELEASES/$1" "$BASE/.current.new"
  mv -T "$BASE/.current.new" "$CURRENT"
}

link_command() {
  ln -sfn "$CURRENT/setup.sh" /usr/local/bin/flyashbricks
}

prune_releases() {
  local keep old
  keep=$(running_version)
  find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -V | head -n -2 |
    while read -r old; do
      [[ "$old" != "$keep" ]] && rm -rf "${RELEASES:?}/$old"
    done
}

create_org() {
  local marker=$CONFIG_DIR/.org-created
  [[ -n "${ORG_NAME:-}" && ! -f "$marker" ]] || return 0
  log "Creating company \"$ORG_NAME\" and its first admin"
  local args=(--org "$ORG_NAME" --name "${ADMIN_NAME:?set ADMIN_NAME}" --phone "${ADMIN_PHONE:?set ADMIN_PHONE}")
  [[ -n "${ADMIN_EMAIL:-}" ]] && args+=(--email "$ADMIN_EMAIL")
  node_in "$CURRENT" create-organization "${args[@]}"
  touch "$marker"
}

print_summary() {
  local url
  url=$(sed -n 's/^APP_URL="\(.*\)"$/\1/p' "$CONFIG")
  cat <<EOF

Fly Ash Bricks $(running_version) is running on http://$(primary_ip):$PORT

  Point the Cloudflare Tunnel's public hostname at that address (type HTTP),
  then open $url

  Update:     the app's Updates page, or: flyashbricks update
  Settings:   $CONFIG  (then: systemctl restart flyashbricks)
  Logs:       journalctl -u flyashbricks -f
EOF
}

# Run from the release being activated, so a release brings its own steps.
cmd_activate() {
  local version=$1 previous node_major
  require_root
  [[ -d "$RELEASES/$version" ]] || die "Release $version is not unpacked."
  previous=$(running_version)
  node_major=$(sed -n 's/^NODE_MAJOR=//p' "$RELEASES/$version/release.env")
  ensure_node "${node_major:-24}"

  log "Preparing the database for $version"
  node_in "$RELEASES/$version" migrate up

  switch_to "$version"
  link_command
  install_units
  log "Starting $version"
  systemctl restart flyashbricks
  if ! wait_until_ready; then
    if [[ "$previous" != none && "$previous" != "$version" ]]; then
      log "$version did not start; going back to $previous"
      switch_to "$previous"
      systemctl restart flyashbricks
    fi
    die "$version did not become ready. See: journalctl -u flyashbricks -n 100"
  fi
  prune_releases
}

cmd_install() {
  local version
  require_root
  if [[ -f "$ANSWERS_FILE" ]]; then
    # shellcheck source=/dev/null
    source "$ANSWERS_FILE"
  fi
  install_packages
  ensure_user_and_dirs
  ensure_mongodb
  write_config

  if [[ -n "${RELEASE_FILE:-}" ]]; then
    version=$(basename "$RELEASE_FILE" | sed -n 's/^flyashbricks-\(v[0-9.]*[0-9]\)-linux-.*/\1/p')
  else
    version=$(latest_release)
  fi
  [[ "$version" =~ $RELEASE_TAG ]] || die "No published release found for $REPO."
  fetch_release "$version"
  bash "$RELEASES/$version/setup.sh" activate "$version" || {
    rm -rf "${RELEASES:?}/$version"
    exit 1
  }
  create_org
  rm -f "$ANSWERS_FILE"
  print_summary
}

cmd_update() {
  local target=${1:-}
  require_root
  [[ -f "$CONFIG" ]] || die 'Not installed yet; run install first.'
  [[ -z "$target" || "$target" =~ $RELEASE_TAG ]] || die "Not a release version: $target"
  # Held until the update ends, through the exec below.
  exec 9>/run/flyashbricks-update.lock
  flock -n 9 || die 'Another update is already running.'
  [[ -n "$target" ]] || target=$(latest_release)
  [[ -n "$target" ]] || die 'Could not find the newest release on GitHub.'
  if [[ "$target" == "$(running_version)" ]]; then
    log "Already running $target"
    return 0
  fi
  fetch_release "$target"
  # The new release's own script finishes the job (the lock stays held).
  if ! bash "$RELEASES/$target/setup.sh" activate "$target"; then
    # Downloaded again if it is retried, rather than reused as it is.
    [[ "$(running_version)" == "$target" ]] || rm -rf "${RELEASES:?}/$target"
    exit 1
  fi
}

# write_status STATE VERSION FROM STARTED [FINISHED] — read by the app, so
# written whole with a rename. Every value is a tag, a version or a date,
# none of which needs JSON escaping.
write_status() {
  local finished=null
  [[ -n "${5:-}" ]] && finished="\"$5\""
  printf '{"state":"%s","version":"%s","from":"%s","startedAt":"%s","finishedAt":%s}\n' \
    "$1" "$2" "$3" "$4" "$finished" >"$UPDATER_DIR/.status.json.tmp"
  chmod 644 "$UPDATER_DIR/.status.json.tmp"
  mv -f "$UPDATER_DIR/.status.json.tmp" "$UPDATER_DIR/status.json"
}

# Version from the app's request file, or nothing. The app writes the version
# first; anything else in the file is ignored.
requested_version() {
  sed -n 's/^{"version":"\(v[0-9]\{1,\}\.[0-9]\{1,\}\.[0-9]\{1,\}\)".*/\1/p' "$1" | head -n1
}

# Run by flyashbricks-updater.service when the app leaves a request. Only the
# newest published release is ever installed this way.
cmd_apply_request() {
  local request=$UPDATER_DIR/request.json log=$UPDATER_DIR/update.log
  local version from started latest
  [[ -f "$request" ]] || return 0
  version=$(requested_version "$request")
  rm -f "$request"
  from=$(running_version)
  started=$(date -Iseconds)
  : >"$log"
  chmod 644 "$log"

  latest=$(latest_release)
  if [[ -z "$version" || "$version" != "$latest" ]]; then
    echo "Refused: only the newest release (${latest:-unknown}) can be installed from the app." >>"$log"
    write_status failed "${version:-unknown}" "$from" "$started" "$(date -Iseconds)"
    return 1
  fi

  write_status running "$version" "$from" "$started"
  if /usr/local/bin/flyashbricks update "$version" >>"$log" 2>&1; then
    write_status succeeded "$version" "$from" "$started" "$(date -Iseconds)"
  else
    write_status failed "$version" "$from" "$started" "$(date -Iseconds)"
    return 1
  fi
}

main() {
  case "${1:-}" in
    install) cmd_install ;;
    update) cmd_update "${2:-}" ;;
    activate) cmd_activate "${2:?version}" ;;
    apply-request) cmd_apply_request ;;
    run)
      require_root
      node_in "$CURRENT" "${2:?script name}" "${@:3}"
      ;;
    *) die "Usage: $(basename "$0") install | update [vX.Y.Z] | run <script> [args]" ;;
  esac
}

# Run unless sourced (tests/deploy-scripts.test.ts sources it). Under bash -c
# there is no BASH_SOURCE, so that counts as run.
if [[ "${BASH_SOURCE[0]:-$0}" == "$0" ]]; then
  main "$@"
fi
