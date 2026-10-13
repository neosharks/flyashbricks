# Fly Ash Bricks

Factory manager for fly ash brick plants — raw materials, daily production, brick stock,
sales and payments, invoices, customers, workers' attendance and wages, employees with
per-section access, notifications, an activity log, and encrypted backups.

Mobile-first and installable as an app (PWA), in English and Hindi, built for Indian
businesses: ₹ with lakh/crore grouping, +91 phone numbers, IST days, optional GST with
GSTIN validation (Uttar Pradesh by default).

**Stack:** Node 24 · Next.js 16 (App Router) · React 19 · TypeScript 6 · MongoDB 8.2
(replica set) via Mongoose 9 · Auth.js v5 · next-intl · Tailwind CSS 4 · Zod 4 ·
Vitest + Playwright · pnpm 11.

---

## Run it locally

Requirements: Node 24, pnpm 11, and a MongoDB replica set — `docker-compose.yml` starts one
(with an optional Redis) for development; servers do not use Docker.

```bash
cp .env.example .env          # defaults match docker-compose.yml
docker compose up -d          # development only: MongoDB 8 (replica set) + Redis
pnpm install
pnpm setup                    # sync indexes, seed a demo company
pnpm dev                      # http://localhost:3000
```

The seed creates a demo company in Uttar Pradesh with materials, production, sales, staff
and attendance, and prints the demo logins. Change those passwords before showing the app
to anyone. Already using
ports 27017/6379? Set `MONGO_PORT` / `REDIS_PORT` in `.env` and point `MONGODB_URI` /
`REDIS_URL` at them.

Add a real company and its first admin (there is no public sign-up):

```bash
pnpm org:create --org "Shree Ganesh Bricks" --name "Owner Name" --phone 9876543210 --email owner@example.com
```

---

## What it does

| Area                   | Highlights                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**          | Today at a glance, quick actions, charts with fullscreen view, tap/hover details and plain-language insights                                                    |
| **Raw materials**      | Fly ash, cement, sand/stone dust, lime, gypsum… levels with gauges, purchases, adjustments, low-stock alerts, days-left forecast                                |
| **Production**         | Daily entries (good / defective) per brick type; materials consumed automatically from the recipe; void with reversal                                           |
| **Brick stock**        | Live stock per brick type, "can make N more" from current materials, adjustments, full movement history; sales deduct stock automatically                       |
| **Sales & invoices**   | Bills with lines and per-sale brick price, delivery, discount, optional GST (CGST/SGST/IGST), printable invoices numbered per financial year                    |
| **Payments & dues**    | Payments over time, pending amounts with how long they have been due, weekly/monthly figures, CSV export                                                        |
| **Customers**          | Identified by phone (several per person), history, totals billed / paid / due                                                                                   |
| **Staff & attendance** | Workers without logins, daily attendance sheet and calendar, overtime and bricks made, wages and advances, money paid per worker over time                      |
| **Employees**          | Admin-created logins, temporary passwords (expire in 72 h), per-section access (none / view / edit), login history, disable, sign out everywhere                |
| **Notifications**      | Bell with unread count, inbox with filters, deep links; each person picks email / SMS / WhatsApp per alert — see [docs/notifications.md](docs/notifications.md) |
| **Activity log**       | Every change: who, what, when                                                                                                                                   |
| **Backups**            | Admin-only encrypted download, email, and nightly scheduled backups — see [docs/backup.md](docs/backup.md)                                                      |
| **Everyone**           | English / Hindi (names in both scripts, auto-transliterated), light / dark theme, text size and bold text settings, photos or cartoon avatars                   |

Every table has search, sorting, filters, grouping where useful, and pagination; state
lives in the URL so a view can be shared or bookmarked.

Default recipe (editable per brick type) follows the common cement-based mix for a
230 × 110 × 75 mm brick of ~2.5 kg: fly ash 60 %, sand/stone dust 30 %, cement 10 %.

---

## How it is put together

```
app/            routes — (auth) login/set-password · (app) the signed-in app · api/
components/     ui/ primitives · charts/ (plain SVG) · one folder per feature
features/       one folder per domain: schema.ts, queries.ts, actions.ts, core logic + tests
lib/            infrastructure: db, auth, session, permissions, money, quantity, dates, table…
models/         Mongoose schemas
messages/       en/ and hi/ — one JSON per area
scripts/        migrate, seed, org:create, backup decrypt/restore, icons
deploy/         Proxmox installer and server setup (systemd, MongoDB, releases)
docs/adr/       decisions and why
```

Rules this codebase follows are in [CLAUDE.md](CLAUDE.md) and
[`../development-guidelines`](../development-guidelines). Decisions are in
[docs/adr](docs/adr).

---

## Quality gates

```bash
pnpm validate        # typecheck + lint (0 warnings) + prettier check + tests
pnpm build
```

Tests run against a real in-memory MongoDB replica set (transactions included), so the
first run downloads a MongoDB binary.

---

## Install on Proxmox

In the Proxmox host's shell (Datacenter → your node → **Shell**), as root:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/neosharks/flyashbricks/main/deploy/proxmox/install.sh)"
```

It asks a few questions (press Enter for the defaults) and creates a small unprivileged
Ubuntu 24.04 container (2 cores, 1.5 GB RAM, 8 GB disk). Inside it, Node.js and MongoDB run
as ordinary services — no Docker — and the newest ready-built release is downloaded, so
nothing is compiled on the server. It generates every secret, prepares the database, and
creates your company and its first admin, printing the temporary password once at the end.

The app is reached through a **Cloudflare Tunnel**. Create the tunnel first (Zero Trust →
Networks → Tunnels → Create, type Cloudflared), give it the public hostname you want with
service type **HTTP** and URL **`localhost:3000`**, and copy its token (the value starting
with `eyJ`). The installer asks for the public address and that token, runs the connector
inside the container over HTTP/2, and keeps the app listening on localhost only. Without a
token, point a connector elsewhere at `http://<container IP>:3000`.

On the server:

| What                  | Where / how                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| Settings and secrets  | `/etc/flyashbricks/env`, then `systemctl restart flyashbricks`          |
| Logs                  | `journalctl -u flyashbricks -f`                                         |
| Uploads and backups   | `/var/lib/flyashbricks`                                                 |
| Add a company / admin | `flyashbricks run create-organization --org "…" --name "…" --phone 98…` |
| Health                | `/api/healthz` (liveness), `/api/readyz` (database reachable)           |

Not on Proxmox? On any Ubuntu 24.04 server or VM, as root, with `APP_URL` set:

```bash
APP_URL=https://bricks.example.com bash -c "$(curl -fsSL https://raw.githubusercontent.com/neosharks/flyashbricks/main/deploy/proxmox/setup.sh)" setup install
```

Before going live, work through the checklist in [docs/security.md](docs/security.md). Why it
is built this way: [ADR 0010](docs/adr/0010-native-install.md).

### Updates

Versions are git tags (`v0.2.0`, `v0.3.0`, …), each published as a GitHub release with
ready-built archives. An admin opens **Administration → Updates** in the app, reads what is
new, and presses **Update**: the server downloads the release, prepares the database, switches
over, and switches back if the new version does not start. It takes about a minute, and the
page follows along. Only the newest release can be installed this way, never an older one.

The app itself runs unprivileged. It leaves a request in `/var/lib/flyashbricks/updater`; a
systemd unit checks it against the newest release and runs the update as root. The same from
the Proxmox host:

```bash
pct exec <container id> -- flyashbricks update            # newest release
pct exec <container id> -- flyashbricks update v0.3.0     # a specific one
```

**Publishing a release:** set `version` in `package.json`, push to `main`, and once CI is
green tag that commit: `git tag v0.3.0 && git push origin v0.3.0`. The release workflow checks
the tag matches `package.json`, builds an archive for x64 and arm64
(`scripts/package-release.sh`), and publishes them with the commit subjects as the notes,
which is what admins see before updating.

---

## Security

- No public sign-up; sign-in by phone or email with rate limits per address and per account.
- Sessions are re-checked against the database on every request, so disabling someone or
  changing their access takes effect at once.
- Every record is scoped to its company; access is deny-by-default per section.
- Strict Content-Security-Policy, HSTS, same-origin checks on uploads, and uploads served
  only through the app after a permission check.
- Backups are encrypted with a passphrase before they are written or sent.
- In production the app refuses to start with placeholder secrets or non-HTTPS URLs.

Found a problem? Please report it privately to the maintainers rather than opening a
public issue.

---

## Credits

Built with ❤ by [NeoSharks](https://www.neosharks.in/).
