// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Types, type ObjectId } from '@/lib/mongoose';
import { clearTestDb, startTestDb, stopTestDb } from '@/tests/db';
import type { SessionUser } from '@/lib/permissions';
import { NO_ACCESS } from '@/lib/permissions';
import { ProductionEntry } from '@/models/production-entry';
import { StockMovement } from '@/models/stock-movement';
import { startOfDay } from '@/lib/dates';

// The test connects Mongoose itself; the app's connector would look for MONGODB_URI.
vi.mock('@/lib/db', () => ({ connectDb: () => Promise.resolve() }));

const { groupProduction, listProductionEntries } = await import('./queries');
const { groupStockMovements, listStockMovements } = await import('@/features/stock/queries');

beforeAll(startTestDb, 180_000);
afterEach(clearTestDb);
afterAll(stopTestDb);

const TZ = 'Asia/Kolkata';
const ORG = new Types.ObjectId();
const viewer: SessionUser = {
  id: new Types.ObjectId().toString(),
  orgId: ORG.toString(),
  name: 'Owner',
  role: 'admin',
  permissions: NO_ACCESS,
  mustChangePassword: false,
};
const ALL = { preset: 'all' as const, from: null, to: null };
const SOLID = new Types.ObjectId();
const HOLLOW = new Types.ObjectId();

async function entry(
  day: string,
  good: number,
  broken: number,
  extra: {
    productId?: ObjectId;
    by?: string;
    voided?: boolean;
    orgId?: ObjectId;
    note?: string;
  } = {},
) {
  await ProductionEntry.create({
    orgId: extra.orgId ?? ORG,
    productId: extra.productId ?? SOLID,
    productName: extra.productId === HOLLOW ? 'Hollow' : 'Solid',
    date: startOfDay(day, TZ),
    goodQty: good,
    defectiveQty: broken,
    note: extra.note ?? null,
    createdBy: new Types.ObjectId(),
    createdByName: extra.by ?? 'Rajesh Sharma',
    voidedAt: extra.voided ? new Date() : null,
  });
}

describe('groupProduction', () => {
  it('subtotals per Monday-start week, leaving out cancelled entries and other companies', async () => {
    await entry('2026-10-05', 1000, 20); // Monday
    await entry('2026-10-11', 500, 10); // Sunday, same week
    await entry('2026-10-12', 700, 7); // next Monday
    await entry('2026-10-12', 9999, 0, { voided: true });
    await entry('2026-10-12', 8888, 0, { orgId: new Types.ObjectId() });

    const rows = await groupProduction(viewer, 'week', { productId: null, range: ALL, q: '' }, TZ);
    expect(rows.map((row) => [row.key, row.good, row.defective, row.entries])).toEqual([
      ['2026-10-12', 700, 7, 1],
      ['2026-10-05', 1500, 30, 2],
    ]);
    expect(rows[1]?.link).toEqual({ from: '2026-10-05', to: '2026-10-11' });
  });

  it('groups by brick type and by person, with links that filter the list', async () => {
    await entry('2026-10-05', 1000, 0, { productId: SOLID, by: 'Rajesh' });
    await entry('2026-10-06', 300, 0, { productId: HOLLOW, by: 'Pooja' });
    await entry('2026-10-07', 200, 0, { productId: HOLLOW, by: 'Rajesh' });

    const byType = await groupProduction(
      viewer,
      'brickType',
      { productId: null, range: ALL, q: '' },
      TZ,
    );
    expect(byType.find((row) => row.label === 'Hollow')).toMatchObject({
      good: 500,
      link: { productId: HOLLOW.toString() },
    });

    const byPerson = await groupProduction(
      viewer,
      'person',
      { productId: null, range: ALL, q: '' },
      TZ,
    );
    expect(byPerson.map((row) => [row.label, row.good])).toEqual([
      ['Pooja', 300],
      ['Rajesh', 1200],
    ]);
  });
});

describe('listProductionEntries', () => {
  it('searches the person, brick type and note by prefix, ignoring case', async () => {
    await entry('2026-10-05', 100, 0, { by: 'Rajesh Sharma' });
    await entry('2026-10-06', 200, 0, { by: 'Pooja', note: 'Rain stopped work' });
    const params = {
      sort: 'date' as const,
      dir: 'desc' as const,
      after: null,
      before: null,
      size: 25,
    };

    const raj = await listProductionEntries(
      viewer,
      { ...params, productId: null, range: ALL, q: 'raj' },
      TZ,
    );
    expect(raj.rows.map((row) => row.createdByName)).toEqual(['Rajesh Sharma']);
    const rain = await listProductionEntries(
      viewer,
      { ...params, productId: null, range: ALL, q: 'RAIN' },
      TZ,
    );
    expect(rain.rows.map((row) => row.goodQty)).toEqual([200]);
  });

  it('sorts by broken bricks and pages without repeating rows', async () => {
    for (let index = 0; index < 5; index += 1) await entry('2026-10-05', 100, index * 10);
    const params = { sort: 'defectiveQty' as const, dir: 'desc' as const, before: null, size: 2 };
    const filters = { productId: null, range: ALL, q: '' };

    const first = await listProductionEntries(viewer, { ...params, after: null, ...filters }, TZ);
    const second = await listProductionEntries(
      viewer,
      { ...params, after: first.next, ...filters },
      TZ,
    );
    expect([...first.rows, ...second.rows].map((row) => row.defectiveQty)).toEqual([
      40, 30, 20, 10,
    ]);
  });
});

describe('groupStockMovements', () => {
  it('totals bricks in and out per kind of change', async () => {
    const base = {
      orgId: ORG,
      productId: SOLID,
      occurredAt: new Date('2026-10-05T06:00:00Z'),
      createdBy: new Types.ObjectId(),
    };
    await StockMovement.create([
      { ...base, type: 'production', qty: 1000, balanceAfter: 1000 },
      { ...base, type: 'production', qty: 500, balanceAfter: 1500 },
      { ...base, type: 'sale', qty: -800, balanceAfter: 700 },
      { ...base, type: 'sale', qty: -200, balanceAfter: 500, orgId: new Types.ObjectId() },
    ]);
    const filters = { productId: null, type: null, range: ALL, q: '' };

    const rows = await groupStockMovements(viewer, 'type', filters, TZ);
    expect(rows).toEqual([
      { key: 'production', changes: 2, bricksIn: 1500, bricksOut: 0 },
      { key: 'sale', changes: 1, bricksIn: 0, bricksOut: 800 },
    ]);

    const page = await listStockMovements(
      viewer,
      { ...filters, sort: 'qty', dir: 'asc', after: null, before: null, size: 25 },
      TZ,
    );
    expect(page.rows.map((row) => row.qty)).toEqual([-800, 500, 1000]);
  });
});
