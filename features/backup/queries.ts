import 'server-only';
import { Types } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { User } from '@/models/user';
import { keysetPage, type Page, type TableParams } from '@/lib/table';
import { AuditLog } from '@/models/audit-log';
import { BACKUP_ACTIONS, listBackupHistory, type BackupHistoryRow } from './service';

export type BackupOverview = {
  adminEmail: string | null;
  history: BackupHistoryRow[];
};

/** What the backup page shows: where to send a backup, and what has been backed up. */
export async function getBackupOverview(orgId: string, userId: string): Promise<BackupOverview> {
  await connectDb();
  const id = new Types.ObjectId(orgId);

  const [admin, history] = await Promise.all([
    User.findOne({ _id: userId, orgId: id }).select('email').lean(),
    listBackupHistory(orgId),
  ]);

  return {
    adminEmail: admin?.email ?? null,
    history,
  };
}

export const BACKUP_HISTORY_SORTS = ['createdAt'] as const;

/** Every backup ever taken, paged, newest first by default. */
export async function listBackupPage(
  orgId: string,
  params: TableParams<'createdAt'>,
): Promise<Page<BackupHistoryRow>> {
  await connectDb();
  const page = await keysetPage(
    AuditLog,
    { orgId: new Types.ObjectId(orgId), entity: 'Backup', action: { $in: [...BACKUP_ACTIONS] } },
    params,
  );
  return {
    ...page,
    rows: page.rows.map((row) => {
      const changes = row.changes ?? {};
      return {
        id: row._id.toString(),
        action: row.action as BackupHistoryRow['action'],
        actorName: row.actorName,
        encrypted: changes.encrypted === true,
        records: typeof changes.records === 'number' ? changes.records : 0,
        createdAt: row.createdAt.toISOString(),
      };
    }),
  };
}
