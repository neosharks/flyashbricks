# Security

How the app is protected, what the operator must do before going live, and what to do when
something goes wrong. Design decisions behind the pieces are in `docs/adr/` (authentication
0002, CSP 0003, multi-tenancy 0004).

## Threat model in short

| What we protect                             | From                                             |
| ------------------------------------------- | ------------------------------------------------ |
| Each company's records (customers, money)   | Other companies on the same server               |
| Accounts, especially admins                 | Password guessing, stolen sessions, CSRF         |
| Backups — a full copy of a company's data   | Anyone who gets the file without the password    |
| The database, cache and secrets on the host | The internet, and a compromised app container    |
| Audit trail and IP records                  | Forged headers, edits by the people being logged |

Out of scope: an attacker with root on the host, and a malicious operator — both can read
everything by design.

## What is in place

**Application**

- Every query is filtered by the session's `orgId`, never by input (ADR 0004).
- Passwords: bcrypt cost 12, rate-limited sign-in, temporary
  passwords expire and must be changed on first use. `sessionsValidFrom` on a user ends every
  session issued before it — set by password changes, resets, disabling, and "Sign out
  everywhere".
- Server Actions check permissions first and validate every input with Zod; bodies are capped at
  256 KB. The backup download accepts same-origin requests only.
- One strict Content-Security-Policy (`proxy.ts`), HSTS with preload, `X-Frame-Options: DENY`,
  `nosniff`, strict referrer policy (`next.config.ts`).
- Client addresses for login records and the activity log come from `X-Forwarded-For`, read
  `TRUSTED_PROXY_HOPS` entries from the right, so a value a client puts in the header is
  ignored (`lib/request-info.ts`).

**Backups** (details in `docs/backup.md`)

- Locked with AES-256-GCM, key from a 16+ character password via scrypt (N=2^17); the cost is
  stored in the authenticated header, so a tampered file is refused.
- An unlocked download needs the admin's own login password and is flagged in the activity log.
- A restore refuses any file whose records belong to another organisation, and never takes
  password hashes from an unlocked file.

**Deployment** (`docker-compose.prod.yml`)

- Only Caddy publishes ports. MongoDB and Redis are on an internal network with no route to or
  from the internet; the scheduler's network reaches the app and nothing else.
- Each container gets only the variables it needs: the app never sees the MongoDB root password.
- Every container has a read-only root filesystem, all Linux capabilities dropped (Caddy keeps
  only `NET_BIND_SERVICE`) and `no-new-privileges`; the app, scheduler, MongoDB and Redis run
  as non-root users.
- Passwords never appear on a command line: Redis reads its password from a private tmpfs file,
  the MongoDB healthcheck from its environment.
- Caddy answers `404` for `/api/cron/*` from the internet, caps request bodies at 10 MB, and
  overwrites `X-Forwarded-For` / `X-Real-IP`.
- Logs rotate at 10 MB × 5 files per container.

**Supply chain** (`.github/`)

- CI: gitleaks secret scan, `pnpm audit --audit-level=high`, and a Trivy scan of the built
  images that fails on fixable HIGH/CRITICAL issues. Every action is pinned to a commit SHA.
- Dependabot: npm weekly (grouped), GitHub Actions, Dockerfiles and Compose images monthly.
- The pre-commit hook runs gitleaks on staged changes when it is installed
  (`brew install gitleaks`).

## Go-live checklist

Work through this before real data goes in, and again after moving servers.

1. **Secrets** — every value in `.env.production` is freshly generated, none copied from an
   example or another server: `openssl rand -hex 32` for `MONGO_ROOT_PASSWORD`,
   `MONGO_APP_PASSWORD`, `REDIS_PASSWORD`; `openssl rand -base64 48` for `AUTH_SECRET` and
   `CRON_SECRET`. `chmod 600 .env.production`; keep a copy in a password manager.
2. **Mongo keyfile** — generated on this server, `chmod 400`, owned by `999:999` (README).
3. **Volumes** — on a server that ran an older compose file, hand the volumes to the
   unprivileged users once (README, "Upgrading").
4. **Firewall** — only 22, 80 and 443 open on the host. SSH by key only, password login off.
5. **DNS and HTTPS** — the domain points at the server and Caddy has a certificate
   (`docker compose logs caddy`). `https://<domain>/api/cron/outbox` returns `404`.
6. **Backups** — `BACKUP_PASSPHRASE` set (16+ characters, stored apart from the backups),
   `BACKUP_EMAIL_TO` set so a copy leaves the building, and **one restore tested** into a
   scratch database (`docs/backup.md`).
7. **Assets** — the `assets` volume is backed up too (photos are not in the database backup).
8. **Mail** — `SMTP_URL` works: trigger a password reset or low-stock alert and check it arrives.
9. **First admin** — created with `pnpm org:create`; the temporary password changed at first
   sign-in. No demo data: `pnpm db:seed` refuses production and non-local databases.
10. **Proxy hops** — anything in front of Caddy (Cloudflare, a load balancer)? Then follow
    "Behind Cloudflare or a load balancer" below. Sign in once and check the activity log shows
    your real address.
11. **Updates** — merge Dependabot PRs regularly; rebuild with `docker compose ... up -d
--build --pull always` monthly so base images pick up security fixes.
    The in-app Updates page never gives the app Docker access: it only writes a request file
    that the host's updater (deploy/proxmox/setup.sh) accepts for the newest `vX.Y.Z` tag of
    the repository. Anyone who can push tags to the repository can therefore ship code to
    every server that updates — protect tags on GitHub to the maintainers.

## Behind Cloudflare or a load balancer

Caddy then sees the proxy's address, not the visitor's. Tell Caddy which addresses are the
proxy, and it takes the client address from the proxy's header instead — the app needs no
change and `TRUSTED_PROXY_HOPS` stays `1`, because Caddy still overwrites `X-Forwarded-For`
with that single resolved address. Add at the top of `deploy/Caddyfile`:

```
{
	servers {
		trusted_proxies static <the proxy's IP ranges, e.g. Cloudflare's published list>
		client_ip_headers CF-Connecting-IP X-Forwarded-For
	}
}
```

Only list ranges the proxy really uses; anyone inside them could otherwise choose their own
address. Raise `TRUSTED_PROXY_HOPS` only if you remove Caddy's `header_up` overwrite and let
each proxy append instead. `TRUSTED_PROXY_HOPS=0` ignores the headers entirely (no addresses
recorded) — for running the app with no proxy at all.

## If something goes wrong

**A secret may have leaked** (`.env.production` copied somewhere, a laptop lost):

1. Generate new values for everything that may be exposed.
2. `MONGO_APP_PASSWORD`: change it in MongoDB first —
   `db.getSiblingDB('admin').changeUserPassword('<MONGO_APP_USER>', '<new>')` as root — then in
   `.env.production`. Root password the same way for `<MONGO_ROOT_USER>`.
3. `REDIS_PASSWORD`, `CRON_SECRET`: change in `.env.production` only.
4. `AUTH_SECRET`: changing it signs **everyone** out at once — the right move if it leaked.
5. `docker compose -f docker-compose.prod.yml --env-file .env.production up -d` to apply.
6. `BACKUP_PASSPHRASE`: new backups use the new one; existing files keep the old password, so
   treat every backup made with it as readable by whoever has it.

**An account may be compromised:**

1. In **Users**, disable the account or reset its password — both end all its sessions at once.
   "Sign out everywhere" ends sessions without changing the password.
2. Check the **Activity log** for what the account did, and from which addresses.
3. To sign out every user of one company at once, as the MongoDB root user:
   `db.users.updateMany({ orgId: ObjectId('<orgId>') }, { $set: { sessionsValidFrom: new Date() } })`.
   For every company on the server, rotate `AUTH_SECRET` instead.

**Data was damaged or deleted:**

1. Stop further damage first (disable the account, or stop the app container).
2. Take a fresh backup of the current state before changing anything — it is evidence.
3. Restore the last good backup from the `migrate` container, which reaches the database
   (`docs/backup.md`); it asks for the backup password. Records added since that backup must
   be re-entered.

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production run --rm \
     -v "$PWD/<file>.fabk:/restore.fabk:ro" migrate pnpm backup:restore /restore.fabk --replace --yes
   ```

Afterwards, write down what happened and what changed, and add anything missing to this file.
