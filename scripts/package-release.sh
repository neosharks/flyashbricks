#!/usr/bin/env bash
# Builds the release archive a server installs: the standalone Next.js app,
# the admin scripts bundled into plain JavaScript, and the setup script.
# Nothing in it needs pnpm, TypeScript or a compiler on the server — only Node.
#
#   scripts/package-release.sh          # → dist/flyashbricks-v<version>-linux-<arch>.tar.gz (+ .sha256)
#
# Native modules (sharp) are those of the machine that builds, so build on
# Linux for the architecture the archive is for; CI does one per architecture.
set -euo pipefail

cd "$(dirname "$0")/.."
version=v$(node -p "require('./package.json').version")
case "$(uname -m)" in
  x86_64 | amd64) arch=x64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2 && exit 1 ;;
esac
[[ "$(uname -s)" == Linux ]] || echo "Warning: not on Linux; native modules will not run on a server." >&2

name=flyashbricks-$version-linux-$arch
out=dist/$name
rm -rf dist
mkdir -p "$out"

# The URL is read when the server starts (lib/public-env.ts); this one only
# satisfies the build. Validation is skipped because no database is attached.
APP_URL=http://localhost:3000 SKIP_ENV_VALIDATION=true LOG_LEVEL=info NEXT_TELEMETRY_DISABLED=1 \
  pnpm build

cp -R .next/standalone "$out/app"
cp -R .next/static "$out/app/.next/static"
cp -R public "$out/app/public"
# The standalone output copies the build machine's .env files; a server has its own.
rm -f "$out"/app/.env*

pnpm exec esbuild scripts/migrate.ts scripts/create-organization.ts scripts/backup-restore.ts \
  scripts/backup-decrypt.ts scripts/seed.ts \
  --bundle --splitting --platform=node --format=esm --target=node24 --conditions=react-server \
  --outdir="$out/scripts" --out-extension:.js=.mjs --log-level=warning \
  '--banner:js=import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'

cp deploy/proxmox/setup.sh "$out/setup.sh"
node_major=$(node -p "process.versions.node.split('.')[0]")
printf 'APP_VERSION=%s\nNODE_MAJOR=%s\n' "$version" "$node_major" >"$out/release.env"

tar -C dist -czf "dist/$name.tar.gz" "$name"
(cd dist && sha256sum "$name.tar.gz" >"$name.tar.gz.sha256")
echo "dist/$name.tar.gz"
