import 'server-only';
import { Types } from '@/lib/mongoose';
import { compressBackup, encryptBackup } from '@/lib/backup-crypto';
import { dayKey } from '@/lib/dates';
import { RateLimitError } from '@/lib/errors';
import { currentTraceId } from '@/lib/logger';
import { requestInfo } from '@/lib/request-info';
import { AuditLog } from '@/models/audit-log';
import { Organization } from '@/models/organization';
import type { SessionUser } from '@/lib/permissions';
import { buildBackup, serializeBackup, totalRecords } from './export';

export type BackupFile = {
  filename: string;
  contentType: string;
  content: Buffer;
  encrypted: boolean;
  records: number;
  counts: Record<string, number>;
};

export const BACKUP_ACTIONS = ['backup.download', 'backup.email', 'backup.scheduled'] as const;
export type BackupAction = (typeof BACKUP_ACTIONS)[number];

/** Five on-demand backups per organisation per 15 minutes; each one reads every record. */
const BUDGET = { limit: 5, windowMs: 15 * 60_000 };

function slug(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || 'organisation';
}

/**
 * Builds the backup file for one organisation. With a passphrase it is
 * encrypted and includes password hashes; without one it is plain gzip with
 * the hashes removed.
 */
export async function createBackupFile(
  orgId: string,
  passphrase: string | null,
): Promise<BackupFile> {
  const encrypted = passphrase !== null;
  const backup = await buildBackup(orgId, { includeSecrets: encrypted });
  const plain = serializeBackup(backup);

  const org = await Organization.findById(orgId).select('name timezone').lean();
  const stamp = dayKey(backup.createdAt, org?.timezone);
  const base = `fly-ash-bricks-${slug(org?.name ?? '')}-${stamp}`;

  return encrypted
    ? {
        filename: `${base}.fabk`,
        contentType: 'application/octet-stream',
        content: await encryptBackup(plain, passphrase),
        encrypted,
        records: totalRecords(backup.counts),
        counts: backup.counts,
      }
    : {
        filename: `${base}.json.gz`,
        contentType: 'application/gzip',
        content: await compressBackup(plain),
        encrypted,
        records: totalRecords(backup.counts),
        counts: backup.counts,
      };
}

/**
 * On-demand backups are throttled per organisation using the audit log
 * itself, so the limit holds across replicas and restarts with no extra store.
 */
export async function assertBackupBudget(orgId: string): Promise<void> {
  const since = new Date(Date.now() - BUDGET.windowMs);
  const recent = await AuditLog.find({
    orgId: new Types.ObjectId(orgId),
    entity: 'Backup',
    action: { $in: ['backup.download', 'backup.email'] },
    createdAt: { $gte: since },
  })
    .sort({ createdAt: 1 })
    .select('createdAt')
    .limit(BUDGET.limit)
    .lean();

  if (recent.length >= BUDGET.limit) {
    const oldest = recent[0]?.createdAt.getTime() ?? Date.now();
    throw new RateLimitError(
      Math.max(1, Math.ceil((oldest + BUDGET.windowMs - Date.now()) / 1000)),
    );
  }
}

/**
 * Records a backup in the activity log. Never includes the passphrase or the
 * file. `actor` is null for the scheduled job.
 */
export async function recordBackup(
  orgId: string,
  actor: SessionUser | null,
  action: BackupAction,
  details: { encrypted: boolean; records: number; to?: string[]; file?: string },
): Promise<void> {
  await AuditLog.create({
    orgId: new Types.ObjectId(orgId),
    actorUserId: actor ? new Types.ObjectId(actor.id) : null,
    actorName: actor?.name ?? null,
    action,
    entity: 'Backup',
    entityId: orgId,
    changes: details,
    ip: actor ? (await requestInfo()).ip : null,
    traceId: currentTraceId(),
  });
}

export type BackupHistoryRow = {
  id: string;
  action: BackupAction;
  actorName: string | null;
  encrypted: boolean;
  records: number;
  createdAt: string;
};

export async function listBackupHistory(orgId: string, limit = 10): Promise<BackupHistoryRow[]> {
  const rows = await AuditLog.find({ orgId: new Types.ObjectId(orgId), entity: 'Backup' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return rows
    .filter((row): row is typeof row & { action: BackupAction } =>
      (BACKUP_ACTIONS as readonly string[]).includes(row.action),
    )
    .map((row) => {
      const changes = row.changes ?? {};
      return {
        id: row._id.toString(),
        action: row.action,
        actorName: row.actorName,
        encrypted: changes.encrypted === true,
        records: typeof changes.records === 'number' ? changes.records : 0,
        createdAt: row.createdAt.toISOString(),
      };
    });
}
