# Fly Ash Bricks — working notes

Factory manager for fly ash brick plants: raw materials, production, brick stock, sales,
customers, employees, activity log, backups. Multi-company (organisation-scoped), bilingual
(English + Hindi), mobile-first PWA.

Follows `../development-guidelines/` (general files + `stacks/js-next-react-node-mongo/`).
The sibling `../development-guidelines/ecombro` is the reference implementation many patterns
were taken from.

## Stack

Node 24 · Next.js 16 (App Router, `proxy.ts` not middleware) · React 19 · TypeScript 6 strict ·
Mongoose 9 on MongoDB 8 (replica set — transactions are used) · Auth.js v5 credentials ·
next-intl 4 (cookie locale, no URL prefix) · Tailwind 4 · Zod 4 · Vitest 5 · pnpm 11.

## Commands

```
docker compose up -d        # mongo (rs0) + redis
pnpm setup                  # migrate indexes + seed demo data
pnpm dev
pnpm validate               # typecheck + lint + format:check + test
pnpm org:create --org "X" --name "Y" --phone 98…   # new company + first admin
```

## Rules that are easy to get wrong here

- **Tenant scoping.** Every collection has `orgId`; every query filters by `viewer.orgId` from
  the session, never from input. `can()` also refuses resources from another org.
- **Server Actions** always: `runAction(name, async () => { requirePermission(...); parseOrFail(Schema, ...); ... })`.
  Return `ok()/fail()`; throw `AppError` subclasses for expected failures. Errors are translated
  centrally in `lib/action.ts` from `messages/*/errors.json` (by code) and `validation.json` (by key).
- **Zod messages are translation keys** (`'invalidPhone'`), never English sentences.
- **Forms** use `hooks/use-action-form.ts` (submits via onSubmit so React never wipes input).
- **Money** = integer paise (`lib/money.ts`). **Material quantity** = integer milli-units
  (`lib/quantity.ts`). Brick counts = integers. Never floats.
- **Days** are the organisation's days (`lib/dates.ts`, Asia/Kolkata), not the server's.
- **Brick stock** changes only via `features/stock/ledger.ts#applyStockChange` inside a
  transaction (`lib/transaction.ts`). Raw material balance likewise via its ledger.
- **Notifications**: call `notify()` inside the write's transaction; never send email/SMS inline. Low-stock
  alerts are edge-triggered latches (`lib/low-stock.ts`). Links are `/n/<id>`. See `docs/notifications.md`.
- **Audit**: every write calls `recordAudit` (inside the transaction when there is one). Action
  names are `<entity>.<verb>` and need a label under `activity.actions.<entity>.<verb>`.
- **Tables**: state in the URL; keyset pagination via `lib/table.ts` (never `skip()`); sort fields
  must be non-null on every document.
- **i18n**: one JSON per namespace per language in `messages/{en,hi}/`; keys may not contain dots;
  `i18n/messages.test.ts` enforces en/hi parity and placeholder parity.
- **Charts**: `components/charts/*` — plain SVG, validated palette (`chart-1..3`), status colours
  only with a text label, table fallback for screen readers.
- **Service worker** (`public/sw.js`) caches only static assets and the offline page — never pages
  or data.
