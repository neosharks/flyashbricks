# Backups

A backup is a complete copy of one organisation's data, taken so that nothing is lost if the
database, the server or the disk fails. Only admins can take one (`backup:run`).

## What is in a backup

Every record the organisation owns, read strictly by `orgId`:

`users` · `rawMaterials` · `products` · `customers` · `materialMovements` · `productionEntries` ·
`stockMovements` · `sales` · `auditLogs` · `loginEvents` · `notifications` · `assets` (the list of
uploaded files, not the files) · `staffMembers` · `attendance` · `staffPayments` · `counters`
(the organisation's sale numbers) · the `organization` document itself.

Not included: the outbox (a delivery queue, not data) and anything belonging to another
organisation. The list lives in `features/backup/collections.ts`; a test fails if it drifts.

Documents are written as canonical Extended JSON, so ObjectIds, dates and numbers come back with
their real types on restore.

## The file

| Kind                 | Extension  | Contents                                                      |
| -------------------- | ---------- | ------------------------------------------------------------- |
| Locked (recommended) | `.fabk`    | gzip → AES-256-GCM, key from the password via scrypt (N=2^17) |
| Unlocked             | `.json.gz` | gzip only; **password hashes removed**                        |

Format of `.fabk`: `FABK2\n` · scrypt cost (log2 N, r, p — one byte each) · salt (16 bytes) ·
IV (12) · auth tag (16) · ciphertext. The magic and the cost are bound as associated data, and
GCM's tag means a modified file — including a lowered cost — is refused rather than silently
restored. Files written before the change (`FABK1\n`, scrypt N=2^15) still open. Without the
password the file cannot be opened by anyone.

Every backup password is at least **16 characters**; a short sentence is easiest to remember.

Password hashes (bcrypt) are included only in locked backups, so a restore lets everyone sign in
as before. Restoring an unlocked backup always issues new temporary passwords — even if someone
added hashes to the file, they are ignored, since nothing proves where an unlocked file came
from.

Downloading an unlocked file asks for the admin's own login password as well, and is recorded
in the activity log as an unencrypted download.

## Taking a backup

In the app, **Backup** (admins only):

- **Download backup** — saves the file on the device. Copy it to a pen drive or cloud storage.
- **Email backup** — sends the locked file as an attachment (never unlocked). Tell the recipient
  the password by phone, not in the same email. Files over ~18MB must be downloaded instead.

Both are limited to 5 per organisation per 15 minutes and recorded in the activity log (never
the password).

## Automatic daily backups

`POST /api/cron/backup` with `Authorization: Bearer $CRON_SECRET` backs up every organisation.
Configure in the server's environment:

| Variable                | Meaning                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `BACKUP_PASSPHRASE`     | Password every automatic backup is locked with (16+ chars). Required. |
| `BACKUP_DIR`            | Folder to write `<orgId>/<timestamp>.fabk` into (files are `0600`).   |
| `BACKUP_RETENTION_DAYS` | Files older than this are pruned (default 30).                        |
| `BACKUP_EMAIL_TO`       | Comma-separated addresses that receive each backup.                   |

With no passphrase, or with neither a folder nor an address, the job does nothing.

With `docker-compose.prod.yml` the `scheduler` container already calls it at 02:30 IST over the
private network. Caddy answers `404` for every `/api/cron/*` path from the internet, so on any
other setup call it from the same machine or private network, e.g. from cron on the host:

```
15 2 * * *  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/backup
```

**Several organisations on one server** share the one `BACKUP_PASSPHRASE` and the
`BACKUP_EMAIL_TO` list: the nightly files are for the server's operator, not for each company.
Anyone holding that passphrase can open every organisation's backup, so keep it with the
operator only. A company that wants a backup only it can open downloads one from the app with
its own password.

## Reading a backup

```
pnpm backup:decrypt fly-ash-bricks-shree-bricks-2026-10-12.fabk --out backup.json
```

The password is taken from `BACKUP_PASSPHRASE` or asked for without echo. The output is written
with `0600` permissions — it contains everything, so delete it when done.

## Restoring

```
pnpm db:migrate                                  # on a fresh database, so indexes exist
pnpm backup:restore <file>                       # only if the organisation is not there
pnpm backup:restore <file> --replace --yes       # wipe that organisation, then restore
```

Before writing anything, the restore checks that every record — and every counter — belongs
to the organisation the file is for, and refuses the whole file otherwise; a file stitched
together from two companies' backups cannot write into another organisation.

The restore writes to the database in `MONGODB_URI`, in batches of 500, each its own
transaction. A restore that fails half way leaves a partial copy; run it again with
`--replace --yes` to clean up and retry. Other organisations in the same database are never
touched.

## Recommended setup

1. Set `BACKUP_PASSPHRASE` and store it in a password manager, **separately** from the backups.
2. Point `BACKUP_DIR` at a different disk (or a mounted network share) from the database.
3. Also set `BACKUP_EMAIL_TO` so a copy leaves the building every day.
4. Download a backup by hand before any server upgrade or move.
5. **Test a restore every quarter** into a scratch database, and note how long it took. A backup
   that has never been restored is a hope, not a backup.

## Photos and other uploaded files

A backup holds every database record, including the list of uploaded photos,
but not the image files themselves — they live in the storage folder
(`STORAGE_DIR`, the `assets` Docker volume in production). Back that folder up
alongside the database backups, for example with a nightly `rsync` or volume
snapshot. If it is lost, everything else still restores; people simply show
initials until a new photo is added.
