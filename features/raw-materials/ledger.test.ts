// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from '@/lib/mongoose';
import { clearTestDb, startTestDb, stopTestDb, syncIndexes } from '@/tests/db';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { RawMaterial } from '@/models/raw-material';
import { MaterialMovement } from '@/models/material-movement';
import { Notification } from '@/models/notification';
import { aUser } from '@/tests/factories';
import { applyMaterialChange, type MaterialChange } from './ledger';

beforeAll(async () => {
  await startTestDb();
  await syncIndexes([RawMaterial, MaterialMovement]);
}, 180_000);
afterEach(clearTestDb);
afterAll(stopTestDb);

const ORG = new Types.ObjectId();
const ACTOR = new Types.ObjectId().toString();

async function seedMaterial(quantityMilli: number, lowThresholdMilli = 0, orgId = ORG) {
  const material = await RawMaterial.create({
    orgId,
    name: `Cement ${new Types.ObjectId().toString()}`,
    kind: 'cement',
    unit: 'bag',
    quantityMilli,
    lowThresholdMilli,
  });
  return material._id.toString();
}

function change(
  materialId: string,
  qtyMilli: number,
  overrides: Partial<MaterialChange> = {},
): MaterialChange {
  return {
    orgId: ORG.toString(),
    materialId,
    qtyMilli,
    type: qtyMilli > 0 ? 'purchase' : 'consumption',
    occurredAt: new Date('2026-10-01T06:00:00Z'),
    actorId: ACTOR,
    ...overrides,
  };
}

async function inTx<T>(fn: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

describe('applyMaterialChange', () => {
  it('adds a purchase and records the balance after it', async () => {
    const id = await seedMaterial(10_000);
    const balance = await inTx((session) =>
      applyMaterialChange(
        change(id, 50_000, { costPaise: 1_900_000, supplier: 'UltraTech' }),
        session,
      ),
    );
    expect(balance).toBe(60_000);
    const movement = await MaterialMovement.findOne({ materialId: id }).lean();
    expect(movement).toMatchObject({
      qtyMilli: 50_000,
      balanceAfterMilli: 60_000,
      costPaise: 1_900_000,
    });
  });

  it('never lets the balance go below zero', async () => {
    const id = await seedMaterial(1_000);
    await expect(
      inTx((session) => applyMaterialChange(change(id, -1_001), session)),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await RawMaterial.findById(id).lean())?.quantityMilli).toBe(1_000);
    expect(await MaterialMovement.countDocuments({ materialId: id })).toBe(0);
  });

  it('lets only one of two racing consumptions take the last stock', async () => {
    const id = await seedMaterial(10_000);
    const results = await Promise.allSettled([
      inTx((session) => applyMaterialChange(change(id, -8_000), session)),
      inTx((session) => applyMaterialChange(change(id, -8_000), session)),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await RawMaterial.findById(id).lean())?.quantityMilli).toBe(2_000);
  });

  it('refuses a material from another organisation', async () => {
    const foreign = await seedMaterial(10_000, 0, new Types.ObjectId());
    await expect(
      inTx((session) => applyMaterialChange(change(foreign, 1_000), session)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('alerts once when the balance crosses the low threshold', async () => {
    await aUser(ORG);
    const id = await seedMaterial(30_000, 20_000);
    await inTx((session) => applyMaterialChange(change(id, -15_000), session));
    await inTx((session) => applyMaterialChange(change(id, -5_000), session));
    expect(await Notification.countDocuments({ type: 'material_low' })).toBe(1);

    await inTx((session) => applyMaterialChange(change(id, 100_000), session));
    expect((await RawMaterial.findById(id).lean())?.lowAlertedAt).toBeNull();
  });
});
