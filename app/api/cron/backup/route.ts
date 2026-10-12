import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { connectDb } from '@/lib/db';
import { env } from '@/lib/env';
import { isAuthorisedCron } from '@/lib/cron-auth';
import { logger, reportUnexpected, withTrace } from '@/lib/logger';
import { sendMail } from '@/lib/mailer';
import { publicEnv } from '@/lib/public-env';
import { Organization } from '@/models/organization';
import { backupEmail } from '@/features/backup/email';
import { createBackupFile, recordBackup } from '@/features/backup/service';
import { notify } from '@/features/notifications/notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DAY_MS = 86_400_000;

/** Deletes this organisation's scheduled backups older than the retention window. */
async function prune(directory: string, retentionDays: number): Promise<number> {
  const cutoff = Date.now() - retentionDays * DAY_MS;
  let removed = 0;
  for (const name of await readdir(directory)) {
    if (!name.endsWith('.fabk')) continue;
    const file = path.join(directory, name);
    if ((await stat(file)).mtimeMs < cutoff) {
      await unlink(file);
      removed += 1;
    }
  }
  return removed;
}

/**
 * Daily backup of every organisation, encrypted with BACKUP_PASSPHRASE,
 * written to BACKUP_DIR and/or emailed to BACKUP_EMAIL_TO. Each organisation is
 * handled on its own, so one failure does not stop the others.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorisedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const passphrase = env.BACKUP_PASSPHRASE;
  const recipients = env.BACKUP_EMAIL_TO;
  if (!passphrase || (!env.BACKUP_DIR && recipients.length === 0)) {
    return NextResponse.json({ skipped: true, reason: 'backups not configured' });
  }

  return withTrace(async () => {
    await connectDb();
    const orgs = await Organization.find().select('_id').lean();
    let succeeded = 0;
    let failed = 0;

    for (const org of orgs) {
      const orgId = org._id.toString();
      try {
        const file = await createBackupFile(orgId, passphrase);
        let written: string | undefined;

        if (env.BACKUP_DIR) {
          const directory = path.resolve(env.BACKUP_DIR, orgId);
          await mkdir(directory, { recursive: true, mode: 0o700 });
          written = `${new Date().toISOString().replace(/[:.]/g, '-')}.fabk`;
          await writeFile(path.join(directory, written), file.content, { mode: 0o600 });
          await prune(directory, env.BACKUP_RETENTION_DAYS);
        }

        if (recipients.length > 0) {
          await sendMail({
            to: recipients,
            ...backupEmail({
              appName: publicEnv.NEXT_PUBLIC_APP_NAME,
              requestedBy: null,
              records: file.records,
              scheduled: true,
            }),
            attachments: [
              { filename: file.filename, content: file.content, contentType: file.contentType },
            ],
          });
        }

        await recordBackup(orgId, null, 'backup.scheduled', {
          encrypted: true,
          records: file.records,
          ...(recipients.length > 0 ? { to: recipients } : {}),
          ...(written ? { file: written } : {}),
        });
        succeeded += 1;
      } catch (err) {
        failed += 1;
        const traceId = reportUnexpected(err, 'scheduled backup failed', { org_id: orgId });
        // Admins hear about it the same day, not when they next need the backup.
        await notify({
          orgId,
          type: 'backup_failed',
          params: { reference: traceId },
          href: '/backup',
          dedupeKey: `backup_failed:${new Date().toISOString().slice(0, 10)}`,
        }).catch((notifyErr: unknown) =>
          reportUnexpected(notifyErr, 'could not notify about failed backup', { org_id: orgId }),
        );
      }
    }

    logger.info({ succeeded, failed }, 'scheduled backups finished');
    return NextResponse.json({ succeeded, failed }, { status: failed > 0 ? 500 : 200 });
  });
}
