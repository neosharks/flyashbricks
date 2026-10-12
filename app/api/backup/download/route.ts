import { NextResponse } from 'next/server';
import { connectDb } from '@/lib/db';
import { AppError, RateLimitError } from '@/lib/errors';
import { formDataToObject, fieldErrors } from '@/lib/action';
import { logger, reportUnexpected, withTrace } from '@/lib/logger';
import { publicEnv } from '@/lib/public-env';
import { verifyPassword } from '@/lib/password';
import { rateLimit } from '@/lib/rate-limit';
import { requirePermission } from '@/lib/session';
import { User } from '@/models/user';
import { DownloadBackupSchema } from '@/features/backup/schema';
import { assertBackupBudget, createBackupFile, recordBackup } from '@/features/backup/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * The session cookie rides along with any cross-site form post, so a page on
 * another site could otherwise make an admin's browser fetch a backup. Only
 * requests the browser itself marks as same-origin are accepted.
 */
function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = request.headers.get('origin');
  return origin !== null && origin === new URL(publicEnv.NEXT_PUBLIC_APP_URL).origin;
}

/** Streams a backup of the caller's organisation as a file download. Admins only. */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403, headers: NO_STORE });
  }

  return withTrace(async () => {
    try {
      const actor = await requirePermission('backup:run');

      const parsed = DownloadBackupSchema.safeParse(formDataToObject(await request.formData()));
      if (!parsed.success) {
        return NextResponse.json(
          { code: 'VALIDATION_FAILED', fields: fieldErrors(parsed.error) },
          { status: 422, headers: NO_STORE },
        );
      }

      await connectDb();
      await assertBackupBudget(actor.orgId);

      // A readable copy of every record is the most valuable thing an
      // unattended, signed-in browser could hand over, so it takes the
      // admin's own password as well as the session.
      if (parsed.data.unencrypted) {
        const limited = await rateLimit('passwordChange', actor.id);
        if (!limited.success) throw new RateLimitError(limited.resetSeconds);
        const user = await User.findOne({ _id: actor.id, orgId: actor.orgId })
          .select('+passwordHash')
          .lean();
        if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
          logger.warn({ event: 'backup.download_password_failed' }, 'backup password check failed');
          return NextResponse.json(
            { code: 'VALIDATION_FAILED', fields: { currentPassword: ['wrongPassword'] } },
            { status: 422, headers: NO_STORE },
          );
        }
      }

      const file = await createBackupFile(
        actor.orgId,
        parsed.data.unencrypted ? null : parsed.data.passphrase,
      );
      await recordBackup(actor.orgId, actor, 'backup.download', {
        encrypted: file.encrypted,
        records: file.records,
      });
      logger.info(
        { event: 'backup.download', encrypted: file.encrypted, records: file.records },
        'backup downloaded',
      );

      return new Response(new Uint8Array(file.content), {
        status: 200,
        headers: {
          ...NO_STORE,
          'Content-Type': file.contentType,
          'Content-Length': String(file.content.length),
          'Content-Disposition': `attachment; filename="${file.filename}"`,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (err) {
      if (err instanceof RateLimitError) {
        return NextResponse.json(
          { code: err.code, retryAfter: err.retryAfterSeconds },
          { status: 429, headers: { ...NO_STORE, 'Retry-After': String(err.retryAfterSeconds) } },
        );
      }
      if (err instanceof AppError) {
        return NextResponse.json({ code: err.code }, { status: err.status, headers: NO_STORE });
      }
      const traceId = reportUnexpected(err, 'backup download failed');
      return NextResponse.json(
        { code: 'INTERNAL_ERROR', traceId },
        { status: 500, headers: NO_STORE },
      );
    }
  });
}
