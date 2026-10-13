import { NextResponse } from 'next/server';
import { Types } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '@/lib/errors';
import { recordAudit } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import { reportUnexpected, withTrace } from '@/lib/logger';
import { requireUser } from '@/lib/session';
import { can, type SessionUser } from '@/lib/permissions';
import { publicEnv } from '@/lib/public-env';
import { assertUploadSize, deleteAsset, storeImage } from '@/features/assets/service';
import { User } from '@/models/user';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Cookie-authenticated uploads must come from the app itself, not a page on another site. */
function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  return request.headers.get('origin') === new URL(publicEnv.APP_URL).origin;
}

/** Anyone may change their own photo; changing someone else's needs `users:write` over them. */
async function authorise(actor: SessionUser, userId: string) {
  if (!Types.ObjectId.isValid(userId)) throw new NotFoundError('User');
  await connectDb();
  const target = await User.findOne({ _id: userId, orgId: actor.orgId })
    .select('role avatarAssetId')
    .lean();
  if (!target) throw new NotFoundError('User');
  const self = target._id.toString() === actor.id;
  if (!self && !can(actor, 'users:write', { orgId: actor.orgId, targetRole: target.role })) {
    throw new ForbiddenError();
  }
  return target;
}

function errorResponse(err: unknown): NextResponse {
  if (err instanceof RateLimitError) {
    return NextResponse.json(
      { code: err.code, retryAfter: err.retryAfterSeconds },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': String(err.retryAfterSeconds) } },
    );
  }
  if (err instanceof ValidationError) {
    return NextResponse.json(
      { code: err.code, fields: err.fields },
      { status: 422, headers: NO_STORE },
    );
  }
  if (err instanceof AppError) {
    return NextResponse.json({ code: err.code }, { status: err.status, headers: NO_STORE });
  }
  const traceId = reportUnexpected(err, 'avatar update failed');
  return NextResponse.json({ code: 'INTERNAL_ERROR', traceId }, { status: 500, headers: NO_STORE });
}

/** Sets or replaces a user's photo (multipart field `file`). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
  const { id } = await params;

  return withTrace(async () => {
    try {
      const actor = await requireUser();
      const target = await authorise(actor, id);

      const limited = await rateLimit('upload', actor.id);
      if (!limited.success) throw new RateLimitError(limited.resetSeconds);

      assertUploadSize(request);

      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) throw new ValidationError('No file', { file: ['required'] });

      const asset = await storeImage({
        orgId: actor.orgId,
        purpose: 'avatar',
        ownerId: id,
        createdBy: actor.id,
        file: Buffer.from(await file.arrayBuffer()),
      });

      await User.updateOne(
        { _id: target._id, orgId: actor.orgId },
        { $set: { avatarAssetId: asset._id } },
      );
      if (target.avatarAssetId) await deleteAsset(actor.orgId, target.avatarAssetId.toString());

      await recordAudit({
        actor,
        action: 'user.photo_change',
        entity: 'User',
        entityId: id,
        changes: { bytes: asset.bytes, originalBytes: asset.originalBytes },
      });

      return NextResponse.json({ assetId: asset._id.toString() }, { headers: NO_STORE });
    } catch (err) {
      return errorResponse(err);
    }
  });
}

/** Removes a user's photo. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
  const { id } = await params;

  return withTrace(async () => {
    try {
      const actor = await requireUser();
      const target = await authorise(actor, id);
      if (target.avatarAssetId) {
        await User.updateOne(
          { _id: target._id, orgId: actor.orgId },
          { $set: { avatarAssetId: null } },
        );
        await deleteAsset(actor.orgId, target.avatarAssetId.toString());
        await recordAudit({ actor, action: 'user.photo_remove', entity: 'User', entityId: id });
      }
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    } catch (err) {
      return errorResponse(err);
    }
  });
}
