# 0010 — Native install from ready-built releases, no Docker

**Status:** accepted

## Context

The app runs for one business on one small machine, typically a Proxmox
container, reached through a Cloudflare Tunnel. The first deployment used
Docker Compose with Caddy, Redis and a scheduler container, and built the
image on the server: six containers, a Docker daemon, and 2–3 GB of memory and
several minutes for every install or update.

## Decision

- Each release (`vX.Y.Z` tag) is built once by GitHub Actions into an archive
  per architecture: the standalone Next.js app, the admin scripts bundled into
  plain JavaScript (`scripts/package-release.sh`), and the setup script.
- `deploy/proxmox/setup.sh` installs Node.js and MongoDB 8.2 (a one-member
  replica set on localhost) as ordinary services on Ubuntu 24.04, downloads the
  release, checks its SHA-256, and runs the app under systemd as an
  unprivileged user. Scheduled jobs are systemd timers calling the `/api/cron`
  endpoints.
- The app URL is read when the server starts (`APP_URL`), not compiled in, so
  one build serves every domain.
- HTTPS is the tunnel's job; the app listens on plain HTTP port 3000.
- Redis is optional: on a single server the rate limiter counts in memory.

## Consequences

- Install and update take about a minute and need no build tools; the machine
  runs Node and MongoDB only (around 1 GB of memory is plenty).
- Updates switch a `current` symlink after migrating, and switch back if the
  new release does not become ready.
- Rate-limit counts reset when the app restarts, and would not hold across
  several processes; set `REDIS_URL` if it ever runs as more than one.
- MongoDB publishes server packages for Ubuntu 24.04 (x64 and arm64), which is
  why the container is Ubuntu rather than Debian.
- Anyone on the network can reach port 3000 directly; see docs/security.md.
