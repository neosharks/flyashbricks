// @vitest-environment node
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Types } from '@/lib/mongoose';
import { ConflictError, ValidationError } from '@/lib/errors';
import { clearTestDb, startTestDb, stopTestDb } from '@/tests/db';
import { aUser } from '@/tests/factories';
import { Asset } from '@/models/asset';
import { User } from '@/models/user';

vi.mock('@/lib/db', () => ({ connectDb: () => Promise.resolve() }));

let dir: string;
const { storeImage, deleteAsset, getAssetForOrg } = await import('./service');
const { removeOrphanAssets } = await import('./cleanup');

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'flyash-assets-'));
  // Tests run with SKIP_ENV_VALIDATION, so the env module is process.env itself.
  process.env.STORAGE_DIR = dir;
  process.env.ASSET_MAX_UPLOAD_MB = '1';
  process.env.ASSET_ORG_QUOTA_MB = '10';
  await startTestDb();
}, 180_000);
afterEach(clearTestDb);
afterAll(async () => {
  await stopTestDb();
  await rm(dir, { recursive: true, force: true });
});

const ORG = new Types.ObjectId().toString();

async function photo(size = 1200): Promise<Buffer> {
  return sharp({ create: { width: size, height: size, channels: 3, background: '#a8432a' } })
    .jpeg()
    .toBuffer();
}

async function filesUnder(prefix: string): Promise<string[]> {
  try {
    return await readdir(path.join(dir, prefix));
  } catch {
    return [];
  }
}

describe('storeImage', () => {
  it('stores three compressed versions and records their sizes', async () => {
    const user = await aUser(ORG);
    const asset = await storeImage({
      orgId: ORG,
      purpose: 'avatar',
      ownerId: user._id.toString(),
      createdBy: user._id.toString(),
      file: await photo(),
    });

    expect(asset.variants.thumb.width).toBe(96);
    expect(asset.bytes).toBe(
      asset.variants.thumb.bytes + asset.variants.medium.bytes + asset.variants.large.bytes,
    );
    expect((await filesUnder(`org/${ORG}/avatars/${asset._id.toString()}`)).sort()).toEqual([
      'large.webp',
      'medium.webp',
      'thumb.webp',
    ]);
  });

  it('refuses files over the upload limit and things that are not images', async () => {
    const owner = new Types.ObjectId().toString();
    const input = { orgId: ORG, purpose: 'avatar' as const, ownerId: owner, createdBy: owner };
    await expect(
      storeImage({ ...input, file: Buffer.alloc(2 * 1024 * 1024, 1) }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      storeImage({ ...input, file: Buffer.from('%PDF-1.7 not a photo') }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await Asset.countDocuments()).toBe(0);
  });

  it('stops at the organisation’s storage quota', async () => {
    const owner = new Types.ObjectId();
    await Asset.create({
      orgId: new Types.ObjectId(ORG),
      purpose: 'avatar',
      ownerId: owner,
      contentType: 'image/webp',
      variants: {
        thumb: { key: 'x/thumb.webp', width: 1, height: 1, bytes: 1 },
        medium: { key: 'x/medium.webp', width: 1, height: 1, bytes: 1 },
        large: { key: 'x/large.webp', width: 1, height: 1, bytes: 1 },
      },
      bytes: 10 * 1024 * 1024,
      originalBytes: 1,
      createdBy: owner,
    });
    await expect(
      storeImage({
        orgId: ORG,
        purpose: 'avatar',
        ownerId: owner.toString(),
        createdBy: owner.toString(),
        file: await photo(),
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('access and cleanup', () => {
  it('never hands one organisation another’s asset', async () => {
    const user = await aUser(ORG);
    const asset = await storeImage({
      orgId: ORG,
      purpose: 'avatar',
      ownerId: user._id.toString(),
      createdBy: user._id.toString(),
      file: await photo(),
    });
    expect(await getAssetForOrg(ORG, asset._id.toString())).not.toBeNull();
    expect(await getAssetForOrg(new Types.ObjectId().toString(), asset._id.toString())).toBeNull();
  });

  it('deletes the files with the record', async () => {
    const user = await aUser(ORG);
    const asset = await storeImage({
      orgId: ORG,
      purpose: 'avatar',
      ownerId: user._id.toString(),
      createdBy: user._id.toString(),
      file: await photo(),
    });
    await deleteAsset(ORG, asset._id.toString());
    expect(await Asset.countDocuments()).toBe(0);
    expect(await filesUnder(`org/${ORG}/avatars/${asset._id.toString()}`)).toEqual([]);
  });

  it('removes old photos nobody uses, and keeps the ones in use', async () => {
    const user = await aUser(ORG);
    const base = {
      orgId: ORG,
      purpose: 'avatar' as const,
      ownerId: user._id.toString(),
      createdBy: user._id.toString(),
    };
    const used = await storeImage({ ...base, file: await photo() });
    const orphan = await storeImage({ ...base, file: await photo() });
    await User.updateOne({ _id: user._id }, { $set: { avatarAssetId: used._id } });

    const later = new Date(Date.now() + 2 * 60 * 60 * 1000);
    expect(await removeOrphanAssets(later)).toBe(1);
    expect(await Asset.exists({ _id: used._id })).not.toBeNull();
    expect(await Asset.exists({ _id: orphan._id })).toBeNull();
  });
});
