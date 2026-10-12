import 'server-only';
import { Types, type ClientSession } from '@/lib/mongoose';
import { env } from '@/lib/env';
import { ConflictError, ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { storage } from '@/lib/storage';
import {
  Asset,
  IMAGE_VARIANTS,
  type AssetDoc,
  type AssetPurpose,
  type ImageVariant,
} from '@/models/asset';
import { processImage, UnsupportedImageError } from './image';

const MB = 1024 * 1024;

/** Formats the browser's file picker is told to offer; the server still checks the bytes. */
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export function maxUploadBytes(): number {
  return env.ASSET_MAX_UPLOAD_MB * MB;
}

/**
 * Refuses an upload before its body is read into memory. A body without a
 * declared length (chunked) is refused too: otherwise a few gigabytes could
 * be streamed in and exhaust the server's memory before any size check ran.
 * Browsers always declare the length of a FormData upload.
 */
export function assertUploadSize(request: Request): void {
  const raw = request.headers.get('content-length');
  const declared = raw === null ? Number.NaN : Number(raw);
  // Room for the multipart boundaries and field headers around the file.
  if (!Number.isFinite(declared) || declared < 0 || declared > maxUploadBytes() + 64 * 1024) {
    throw new ValidationError('File too large or size unknown', { file: ['fileTooLarge'] });
  }
}

export async function orgStorageUsed(orgId: string): Promise<number> {
  const [row] = await Asset.aggregate<{ bytes: number }>([
    { $match: { orgId: new Types.ObjectId(orgId) } },
    { $group: { _id: null, bytes: { $sum: '$bytes' } } },
  ]);
  return row?.bytes ?? 0;
}

/**
 * Compresses, stores and records an image. Files are written before the
 * database row, so a crash in between leaves only unreferenced files — which
 * the daily cleanup removes — never a row pointing at nothing.
 */
export async function storeImage(input: {
  orgId: string;
  purpose: AssetPurpose;
  ownerId: string;
  createdBy: string;
  file: Buffer;
}): Promise<AssetDoc> {
  if (input.file.length === 0) throw new ValidationError('Empty file', { file: ['required'] });
  if (input.file.length > maxUploadBytes()) {
    throw new ValidationError('File too large', { file: ['fileTooLarge'] });
  }

  let processed;
  try {
    processed = await processImage(input.file, { square: input.purpose === 'avatar' });
  } catch (err) {
    if (err instanceof UnsupportedImageError) {
      throw new ValidationError('Not an image', { file: ['notAnImage'] });
    }
    throw err;
  }

  const bytes = IMAGE_VARIANTS.reduce(
    (sum, variant) => sum + processed.variants[variant].buffer.length,
    0,
  );
  const used = await orgStorageUsed(input.orgId);
  if (used + bytes > env.ASSET_ORG_QUOTA_MB * MB) {
    throw new ConflictError('STORAGE_FULL', 'Storage quota reached');
  }

  const id = new Types.ObjectId();
  const prefix = `org/${input.orgId}/${input.purpose}s/${id.toString()}`;
  const variants = {} as AssetDoc['variants'];

  for (const variant of IMAGE_VARIANTS) {
    const { buffer, width, height } = processed.variants[variant];
    const key = `${prefix}/${variant}.webp`;
    await storage().put(key, buffer, processed.contentType);
    variants[variant] = { key, width, height, bytes: buffer.length };
  }

  try {
    return (
      await Asset.create({
        _id: id,
        orgId: new Types.ObjectId(input.orgId),
        purpose: input.purpose,
        ownerId: new Types.ObjectId(input.ownerId),
        contentType: processed.contentType,
        variants,
        bytes,
        originalBytes: input.file.length,
        createdBy: new Types.ObjectId(input.createdBy),
      })
    ).toObject();
  } catch (err) {
    await storage().deletePrefix(`${prefix}/`);
    throw err;
  }
}

/** Removes an asset's files and its record. Safe to call twice. */
export async function deleteAsset(
  orgId: string,
  assetId: string,
  session?: ClientSession,
): Promise<void> {
  const asset = await Asset.findOneAndDelete(
    { _id: assetId, orgId },
    session ? { session } : {},
  ).lean();
  if (!asset) return;
  const prefix = asset.variants.thumb.key.replace(/\/[^/]+$/, '/');
  try {
    await storage().deletePrefix(prefix);
  } catch (err) {
    // The record is gone; leftover files are swept by the cleanup job.
    logger.error({ err, asset_id: assetId }, 'failed to delete asset files');
  }
}

export async function getAssetForOrg(orgId: string, assetId: string) {
  if (!Types.ObjectId.isValid(assetId)) return null;
  return Asset.findOne({ _id: assetId, orgId }).lean();
}

export function isImageVariant(value: string): value is ImageVariant {
  return (IMAGE_VARIANTS as readonly string[]).includes(value);
}
