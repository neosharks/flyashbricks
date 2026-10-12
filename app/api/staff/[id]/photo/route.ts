import { NextResponse } from 'next/server';
import { Types } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { AppError, NotFoundError, RateLimitError, ValidationError } from '@/lib/errors';
import { recordAudit } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import { reportUnexpected, withTrace } from '@/lib/logger';
import { requirePermission } from '@/lib/session';
import type { SessionUser } from '@/lib/permissions';
import { publicEnv } from '@/lib/public-env';
import { assertUploadSize, deleteAsset, storeImage } from '@/features/assets/service';
import { StaffMember } from '@/models/staff-member';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Cookie-authenticated uploads must come from the app itself, not a page on another site. */
function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  return request.headers.get('origin') === new URL(publicEnv.NEXT_PUBLIC_APP_URL).origin;
}

async function loadStaff(actor: SessionUser, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Staff member');
  await connectDb();
  const staff = await StaffMember.findOne({ _id: id, orgId: actor.orgId })
    .select('photoAssetId')
    .lean();
  if (!staff) throw new NotFoundError('Staff member');
  return staff;
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
  const traceId = reportUnexpected(err, 'staff photo update failed');
  return NextResponse.json({ code: 'INTERNAL_ERROR', traceId }, { status: 500, headers: NO_STORE });
}

/** Sets or replaces a worker's photo (multipart field `file`). Needs staff write access. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
  const { id } = await params;

  return withTrace(async () => {
    try {
      const actor = await requirePermission('staff:write');
      const staff = await loadStaff(actor, id);

      const limited = await rateLimit('upload', actor.id);
      if (!limited.success) throw new RateLimitError(limited.resetSeconds);

      assertUploadSize(request);

      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) throw new ValidationError('No file', { file: ['required'] });

      const asset = await storeImage({
        orgId: actor.orgId,
        purpose: 'staff_photo',
        ownerId: id,
        createdBy: actor.id,
        file: Buffer.from(await file.arrayBuffer()),
      });

      await StaffMember.updateOne(
        { _id: staff._id, orgId: actor.orgId },
        { $set: { photoAssetId: asset._id } },
      );
      if (staff.photoAssetId) await deleteAsset(actor.orgId, staff.photoAssetId.toString());

      await recordAudit({
        actor,
        action: 'staff.photo_change',
        entity: 'StaffMember',
        entityId: id,
        changes: { bytes: asset.bytes, originalBytes: asset.originalBytes },
      });

      return NextResponse.json({ assetId: asset._id.toString() }, { headers: NO_STORE });
    } catch (err) {
      return errorResponse(err);
    }
  });
}

/** Removes a worker's photo. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
  const { id } = await params;

  return withTrace(async () => {
    try {
      const actor = await requirePermission('staff:write');
      const staff = await loadStaff(actor, id);
      if (staff.photoAssetId) {
        await StaffMember.updateOne(
          { _id: staff._id, orgId: actor.orgId },
          { $set: { photoAssetId: null } },
        );
        await deleteAsset(actor.orgId, staff.photoAssetId.toString());
        await recordAudit({
          actor,
          action: 'staff.photo_change',
          entity: 'StaffMember',
          entityId: id,
          changes: { removed: true },
        });
      }
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    } catch (err) {
      return errorResponse(err);
    }
  });
}
