# Fly Ash Bricks

Factory manager for fly ash brick plants — raw materials, daily production, brick stock,
sales and payments, invoices, customers, workers' attendance and wages, employees with
per-section access, notifications, an activity log, and encrypted backups.

Mobile-first and installable as an app (PWA), in English and Hindi, built for Indian
businesses: ₹ with lakh/crore grouping, +91 phone numbers, IST days, optional GST with
GSTIN validation (Uttar Pradesh by default).

**Stack:** Node 24 · Next.js 16 (App Router) · React 19 · TypeScript 6 · MongoDB 8.2
(replica set) via Mongoose 9 · Redis · Auth.js v5 · next-intl · Tailwind CSS 4 · Zod 4 ·
Vitest + Playwright · pnpm 11.

---

## Run it locally

Requirements: Node 24, pnpm 11, Docker.

```bash
cp .env.example .env          # defaults match docker-compose.yml
docker compose up -d          # MongoDB 8 (replica set) + Redis
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
deploy/         Caddy, scheduler, Mongo init for docker-compose.prod.yml
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

## Deploy (own server)

```bash
cp deploy/.env.production.example .env.production      # fill in every secret
chmod 600 .env.production
openssl rand -base64 756 > deploy/mongo-keyfile && chmod 400 deploy/mongo-keyfile
sudo chown 999:999 deploy/mongo-keyfile                 # the mongo container's user
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate \
  pnpm org:create --org "Company" --name "Owner" --phone 9876543210
```

Passwords that go into connection URLs (`MONGO_*_PASSWORD`, `REDIS_PASSWORD`) are made with
`openssl rand -hex 32`; `AUTH_SECRET` and `CRON_SECRET` with `openssl rand -base64 48`.
`.env.production` is read by Compose only: each container gets just the values listed for it
in `docker-compose.prod.yml`, so a new setting must be added there as well.

Point the domain's DNS at the server first; Caddy obtains the HTTPS certificate on start.
Only ports 80/443 are published — MongoDB and Redis stay on an internal Docker network with
authentication and no internet access. Every container runs on a read-only filesystem with
all Linux capabilities dropped. Health: `/api/healthz` (liveness), `/api/readyz` (database
reachable). Before going live, work through the checklist in
[docs/security.md](docs/security.md).

**Upgrading a server set up before the hardened compose file:** the app, MongoDB and Redis
now run as their own unprivileged users rather than root. Volumes created earlier may still
be owned by root; hand them over once, then start as usual:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production down
docker run --rm -v fly-ash-bricks_backups:/b -v fly-ash-bricks_assets:/a alpine:3.22 \
  chown -R 1001:1001 /b /a                              # the app's user
docker run --rm -v fly-ash-bricks_mongo-data:/d alpine:3.22 chown -R 999:999 /d
docker run --rm -v fly-ash-bricks_redis-data:/d alpine:3.22 chown -R 999:1000 /d
```

Moving to a cloud later: run the same image against MongoDB Atlas and a managed Redis, and
call `/api/cron/outbox` every minute and `/api/cron/backup` nightly from the platform's
scheduler with `Authorization: Bearer $CRON_SECRET`.

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
