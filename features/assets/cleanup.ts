import 'server-only';
import { connectDb } from '@/lib/db';
import { logger } from '@/lib/logger';
import { Asset } from '@/models/asset';
import { User } from '@/models/user';
import { StaffMember } from '@/models/staff-member';
import { deleteAsset } from './service';

/** Uploads younger than this are left alone: their owner record may still be saving. */
const GRACE_MS = 60 * 60 * 1000;

/**
 * Deletes photos (app logins' and staff's) nothing points at any more — left behind when a replace or
 * delete was interrupted between storing the file and updating the user.
 */
export async function removeOrphanAssets(now = new Date()): Promise<number> {
  await connectDb();
  const candidates = await Asset.find({
    createdAt: { $lt: new Date(now.getTime() - GRACE_MS) },
  })
    .select('orgId ownerId purpose')
    .limit(500)
    .lean();

  let removed = 0;
  for (const asset of candidates) {
    const owner =
      asset.purpose === 'avatar'
        ? await User.exists({ _id: asset.ownerId, avatarAssetId: asset._id })
        : await StaffMember.exists({ _id: asset.ownerId, photoAssetId: asset._id });
    if (owner) continue;
    await deleteAsset(asset.orgId.toString(), asset._id.toString());
    removed += 1;
  }
  if (removed > 0) logger.info({ removed }, 'removed orphaned uploads');
  return removed;
}
