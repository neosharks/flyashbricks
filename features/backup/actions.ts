'use server';

import { connectDb } from '@/lib/db';
import { formDataToObject, parseOrFail, runAction } from '@/lib/action';
import { AppError } from '@/lib/errors';
import { sendMail } from '@/lib/mailer';
import { publicEnv } from '@/lib/public-env';
import { ok, type ActionResult } from '@/lib/result';
import { requirePermission } from '@/lib/session';
import { EmailBackupSchema } from './schema';
import { assertBackupBudget, createBackupFile, recordBackup } from './service';
import { backupEmail } from './email';

/** Most mail providers reject messages over ~25MB once encoded. */
const MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024;

/**
 * Emails an encrypted backup. Done inline rather than through the outbox:
 * queueing it would mean storing either the passphrase or the whole encrypted
 * file in the database, and a backup of the database belongs outside it.
 */
export async function emailBackup(
  _prev: ActionResult<{ to: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ to: string }>> {
  return runAction('backup.email', async () => {
    const actor = await requirePermission('backup:run');

    const parsed = parseOrFail(EmailBackupSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    await connectDb();
    await assertBackupBudget(actor.orgId);

    const file = await createBackupFile(actor.orgId, parsed.data.passphrase);
    if (file.content.length > MAX_ATTACHMENT_BYTES) {
      throw new AppError(
        'BACKUP_TOO_LARGE',
        'The backup is too large to email. Download it instead.',
        413,
      );
    }

    await sendMail({
      to: [parsed.data.to],
      ...backupEmail({
        appName: publicEnv.NEXT_PUBLIC_APP_NAME,
        requestedBy: actor.name,
        records: file.records,
        scheduled: false,
      }),
      attachments: [
        { filename: file.filename, content: file.content, contentType: file.contentType },
      ],
    });

    await recordBackup(actor.orgId, actor, 'backup.email', {
      encrypted: true,
      records: file.records,
      to: [parsed.data.to],
    });

    return ok({ to: parsed.data.to });
  });
}
