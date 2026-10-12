# 0004 — Organisation-scoped documents in one database

**Status:** accepted

## Context

The software is shared by several companies (and several plants within a
company). Data from one must never be visible to another.

## Decision

Every collection carries `orgId`, which is the first field of nearly every
index. It comes only from the signed-in user's session; it is never accepted
from a form or URL. `can()` additionally refuses any resource whose `orgId`
differs from the viewer's, so a missed filter is caught twice. Integration
tests assert cross-organisation reads and writes fail.

New companies are created with `pnpm org:create` (no public sign-up). There is
no super-admin role yet.

## Consequences

- One database to back up and operate; per-company backups are produced by
  filtering on `orgId` (see `docs/backup.md`).
- A company that later needs physical isolation can be moved to its own
  database by restoring its backup there.
