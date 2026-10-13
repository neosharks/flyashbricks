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
- Quick sign-in PIN: only on a device that signed in with the password first. The device holds
  a random 32-byte token in an httpOnly cookie; the server stores its SHA-256 and a bcrypt hash
  of the 6-digit PIN (`models/device-credential.ts`). Rate-limited per address and per device;
  the fifth wrong PIN deletes it. Every PIN a person has is deleted on a password change or
  reset, "Sign out everywhere", disabling the account, or a manager turning PIN sign-in off for
  them; a PIN unused for 90 days expires. PINs are not included in backups.
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

**Deployment** (`deploy/proxmox/setup.sh`, [ADR 0010](adr/0010-native-install.md))

- The app runs under systemd as the unprivileged `flyashbricks` user, with `NoNewPrivileges`,
  no capabilities, a read-only view of the system (`ProtectSystem=strict`) and write access
  only to `/var/lib/flyashbricks`. Memory is capped at 640 MB.
- MongoDB listens on `127.0.0.1` only, with authentication and a replica-set keyfile. The app
  connects as a user limited to its own database; the root password is kept in
  `/etc/flyashbricks/mongo-root` (root only) for maintenance.
- Settings and secrets live in `/etc/flyashbricks/env` (`0640`, root and the app's group),
  generated on the server; nothing secret is in the release archive.
- Releases are downloaded from GitHub and refused unless their SHA-256 matches; Node.js is
  checked against nodejs.org's published sums.
- HTTPS is the Cloudflare Tunnel's job. The app listens on plain HTTP port 3000 for the tunnel
  connector — anyone else who can reach that port can reach the app the same way, so keep it
  on a trusted network. (It cannot listen on `127.0.0.1` only: Next.js then treats its own
  rewrites, such as the public home page, as another origin and fails to load them.)
- `/api/cron/*` needs `CRON_SECRET`; the timers call it on `127.0.0.1`.
- Logs go to the journal (`journalctl -u flyashbricks`), which rotates them itself.

**Supply chain** (`.github/`)

- CI: gitleaks secret scan and `pnpm audit --audit-level=high`. Every action is pinned to a
  commit SHA. Release archives are built by the release workflow, never on a laptop.
- Dependabot: npm weekly (grouped), GitHub Actions monthly.
- The pre-commit hook runs gitleaks on staged changes when it is installed
  (`brew install gitleaks`).

## Go-live checklist

Work through this before real data goes in, and again after moving servers.

1. **Secrets** — `/etc/flyashbricks/env` was generated on this server by the installer, never
   copied from another. Keep a copy of it and of `/etc/flyashbricks/mongo-root` in a password
   manager.
2. **Network** — port 3000 is reachable only from the tunnel connector's network; MongoDB is
   not reachable from outside the machine (`ss -tlnp` shows it on `127.0.0.1`). SSH by key
   only, password login off.
3. **Tunnel** — the public hostname points at `http://<machine>:3000`, and `APP_URL` is that
   hostname. Sign in once and check the activity log shows your real address
   (`CLIENT_IP_HEADER="cf-connecting-ip"`).
4. **Backups** — `BACKUP_PASSPHRASE` set (16+ characters, stored apart from the backups),
   `BACKUP_EMAIL_TO` set so a copy leaves the building, and **one restore tested** into a
   scratch database (`docs/backup.md`).
5. **Uploads** — `/var/lib/flyashbricks/assets` is backed up too (photos are not in the
   database backup).
6. **Mail** — `SMTP_URL` works: trigger a password reset or low-stock alert and check it arrives.
7. **First admin** — created by the installer or `flyashbricks run create-organization`; the
   temporary password changed at first sign-in. No demo data: the seed refuses production.
8. **Updates** — install new releases from the app's Updates page or `flyashbricks update`.
   The Updates page never gives the app root: it only writes a request file that the root
   updater accepts for the newest published `vX.Y.Z` release. Anyone who can publish releases
   on the repository can therefore ship code to every server that updates — protect tags and
   releases on GitHub to the maintainers.

## Behind another proxy

Without Cloudflare, set `CLIENT_IP_HEADER="x-forwarded-for"` and `TRUSTED_PROXY_HOPS` to the
number of proxies in front of the app that append to `X-Forwarded-For`; the address that many
entries from the right is used, so anything a client wrote into the header itself is ignored.
`TRUSTED_PROXY_HOPS=0` ignores the headers entirely (no addresses recorded).

## If something goes wrong

**A secret may have leaked** (`/etc/flyashbricks/env` copied somewhere, a laptop lost):

1. Generate new values for everything that may be exposed (`openssl rand -hex 32`).
2. The database password in `MONGODB_URI`: change it in MongoDB first, as root
   (`mongosh -u root -p --authenticationDatabase admin`, then
   `db.getSiblingDB('admin').changeUserPassword('flyash_app', '<new>')`), then in the env file.
   The root password the same way, then in `/etc/flyashbricks/mongo-root`.
3. `CRON_SECRET`: change in the env file only.
4. `AUTH_SECRET`: changing it signs **everyone** out at once — the right move if it leaked.
5. `systemctl restart flyashbricks` to apply.
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

1. Stop further damage first (disable the account, or `systemctl stop flyashbricks`).
2. Take a fresh backup of the current state before changing anything — it is evidence.
3. Restore the last good backup (`docs/backup.md`); it asks for the backup password. Records
   added since that backup must be re-entered. Copy the file somewhere the app user can read
   it first:

   ```bash
   cp <file>.fabk /var/lib/flyashbricks/backups/ && chown flyashbricks /var/lib/flyashbricks/backups/<file>.fabk
   flyashbricks run backup-restore /var/lib/flyashbricks/backups/<file>.fabk --replace --yes
   ```

Afterwards, write down what happened and what changed, and add anything missing to this file.
