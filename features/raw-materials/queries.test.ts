// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Types } from '@/lib/mongoose';
import { clearTestDb, startTestDb, stopTestDb } from '@/tests/db';
import { NO_ACCESS, type SessionUser } from '@/lib/permissions';
import { MaterialMovement } from '@/models/material-movement';

// The test connects Mongoose itself; the app's connector would look for MONGODB_URI.
vi.mock('@/lib/db', () => ({ connectDb: () => Promise.resolve() }));

const { averageRatePaise, groupMaterialMovements, listMaterialMovements } =
  await import('./queries');

beforeAll(startTestDb, 180_000);
afterEach(clearTestDb);
afterAll(stopTestDb);

const TZ = 'Asia/Kolkata';
const ORG = new Types.ObjectId();
const MATERIAL = new Types.ObjectId();
const viewer: SessionUser = {
  id: new Types.ObjectId().toString(),
  orgId: ORG.toString(),
  name: 'Owner',
  role: 'admin',
  permissions: NO_ACCESS,
  mustChangePassword: false,
};
const ALL = { preset: 'all' as const, from: null, to: null };

function movement(fields: Record<string, unknown>) {
  return {
    orgId: ORG,
    materialId: MATERIAL,
    balanceAfterMilli: 0,
    createdBy: new Types.ObjectId(),
    occurredAt: new Date('2026-10-05T06:00:00Z'),
    ...fields,
  };
}

describe('groupMaterialMovements', () => {
  it('totals purchases per supplier with the average price per unit', async () => {
    await MaterialMovement.create([
      movement({ type: 'purchase', qtyMilli: 40_000, costPaise: 2_600_000, supplier: 'Kota TPS' }),
      movement({ type: 'purchase', qtyMilli: 20_000, costPaise: 1_400_000, supplier: 'Kota TPS' }),
      movement({ type: 'purchase', qtyMilli: 10_000, costPaise: 900_000, supplier: 'Balaji' }),
      movement({ type: 'consumption', qtyMilli: -6_000 }),
      movement({
        type: 'purchase',
        qtyMilli: 99_000,
        costPaise: 9_999_900,
        supplier: 'Kota TPS',
        orgId: new Types.ObjectId(),
      }),
    ]);

    const rows = await groupMaterialMovements(
      viewer,
      MATERIAL.toString(),
      'supplier',
      { type: null, range: ALL, q: '' },
      TZ,
    );
    expect(rows.map((row) => [row.key, row.purchases, row.purchasedMilli, row.spendPaise])).toEqual(
      [
        ['Kota TPS', 2, 60_000, 4_000_000],
        ['Balaji', 1, 10_000, 900_000],
      ],
    );
    // ₹40,000 for 60 tonnes is ₹666.67 a tonne.
    expect(averageRatePaise(4_000_000, 60_000)).toBe(66_667);
  });

  it('per month, separates what came in from what was used and corrected', async () => {
    await MaterialMovement.create([
      movement({ type: 'purchase', qtyMilli: 40_000, costPaise: 2_600_000 }),
      movement({ type: 'consumption', qtyMilli: -6_000 }),
      movement({ type: 'consumption_reversal', qtyMilli: 1_000 }),
      movement({ type: 'adjustment', qtyMilli: -500 }),
      movement({
        type: 'purchase',
        qtyMilli: 5_000,
        costPaise: 300_000,
        occurredAt: new Date('2026-09-10T06:00:00Z'),
      }),
    ]);

    const rows = await groupMaterialMovements(
      viewer,
      MATERIAL.toString(),
      'month',
      { type: null, range: ALL, q: '' },
      TZ,
    );
    expect(rows[0]).toMatchObject({
      key: '2026-10-01',
      purchasedMilli: 40_000,
      spendPaise: 2_600_000,
      usedMilli: 5_000,
      adjustedMilli: -500,
    });
    expect(rows[1]).toMatchObject({ key: '2026-09-01', purchasedMilli: 5_000 });
  });
});

describe('listMaterialMovements', () => {
  it('searches supplier and note, and only sorts by cost when showing purchases', async () => {
    await MaterialMovement.create([
      movement({ type: 'purchase', qtyMilli: 1_000, costPaise: 500, supplier: 'Balaji' }),
      movement({ type: 'purchase', qtyMilli: 1_000, costPaise: 900, supplier: 'Kota' }),
      movement({ type: 'adjustment', qtyMilli: -10, note: 'Balance counted' }),
    ]);
    const base = { after: null, before: null, size: 25, range: ALL };

    const found = await listMaterialMovements(
      viewer,
      MATERIAL.toString(),
      { ...base, sort: 'occurredAt', dir: 'desc', type: null, q: 'bal' },
      TZ,
    );
    expect(found.rows).toHaveLength(2);

    const byCost = await listMaterialMovements(
      viewer,
      MATERIAL.toString(),
      { ...base, sort: 'costPaise', dir: 'desc', type: 'purchase', q: '' },
      TZ,
    );
    expect(byCost.rows.map((row) => row.costPaise)).toEqual([900, 500]);

    // Without the purchases filter, cost order falls back to date order rather than failing on nulls.
    const fallback = await listMaterialMovements(
      viewer,
      MATERIAL.toString(),
      { ...base, sort: 'costPaise', dir: 'desc', type: null, q: '' },
      TZ,
    );
    expect(fallback.rows).toHaveLength(3);
  });
});
