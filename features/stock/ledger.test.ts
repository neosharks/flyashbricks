// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from '@/lib/mongoose';
import { clearTestDb, startTestDb, stopTestDb, syncIndexes } from '@/tests/db';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { Product } from '@/models/product';
import { StockMovement } from '@/models/stock-movement';
import { Notification } from '@/models/notification';
import { aUser } from '@/tests/factories';
import { applyStockChange, type StockChange } from './ledger';

beforeAll(async () => {
  await startTestDb();
  await syncIndexes([Product, StockMovement]);
}, 180_000);
afterEach(clearTestDb);
afterAll(stopTestDb);

const ORG = new Types.ObjectId();
const ACTOR = new Types.ObjectId().toString();

async function seedProduct(stockGood: number, lowStockThreshold = 0, orgId = ORG) {
  const product = await Product.create({
    orgId,
    name: `Brick ${new Types.ObjectId().toString()}`,
    stockGood,
    lowStockThreshold,
  });
  return product._id.toString();
}

function change(productId: string, qty: number, overrides: Partial<StockChange> = {}): StockChange {
  return {
    orgId: ORG.toString(),
    productId,
    qty,
    type: qty > 0 ? 'production' : 'sale',
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

describe('applyStockChange', () => {
  it('adds bricks and records the balance after the change', async () => {
    const productId = await seedProduct(100);
    const balance = await inTx((session) => applyStockChange(change(productId, 250), session));

    expect(balance).toBe(350);
    const movement = await StockMovement.findOne({ productId }).lean();
    expect(movement?.qty).toBe(250);
    expect(movement?.balanceAfter).toBe(350);
  });

  it('refuses to take more bricks than are in stock', async () => {
    const productId = await seedProduct(10);
    await expect(
      inTx((session) => applyStockChange(change(productId, -11), session)),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await Product.findById(productId).lean())?.stockGood).toBe(10);
    expect(await StockMovement.countDocuments({ productId })).toBe(0);
  });

  it('does not oversell when two sales race for the last bricks', async () => {
    const productId = await seedProduct(100);
    const results = await Promise.allSettled([
      inTx((session) => applyStockChange(change(productId, -80), session)),
      inTx((session) => applyStockChange(change(productId, -80), session)),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await Product.findById(productId).lean())?.stockGood).toBe(20);
  });

  it('never touches another organisation’s product', async () => {
    const foreign = await seedProduct(500, 0, new Types.ObjectId());
    await expect(
      inTx((session) => applyStockChange(change(foreign, -1), session)),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect((await Product.findById(foreign).lean())?.stockGood).toBe(500);
  });

  it('notifies once when stock crosses the threshold, and re-arms after restock', async () => {
    await aUser(ORG);
    const productId = await seedProduct(120, 100);

    await inTx((session) => applyStockChange(change(productId, -30), session));
    await inTx((session) => applyStockChange(change(productId, -10), session));
    expect(await Notification.countDocuments({ type: 'bricks_low' })).toBe(1);

    await inTx((session) => applyStockChange(change(productId, 500), session));
    expect((await Product.findById(productId).lean())?.lowAlertedAt).toBeNull();

    await inTx((session) => applyStockChange(change(productId, -500), session));
    expect(await Notification.countDocuments({ type: 'bricks_low' })).toBe(2);
  });

  it('rejects a zero or fractional change outright', async () => {
    const productId = await seedProduct(10);
    await expect(
      inTx((session) => applyStockChange(change(productId, 0), session)),
    ).rejects.toThrow();
    await expect(
      inTx((session) => applyStockChange(change(productId, 1.5), session)),
    ).rejects.toThrow();
  });
});
