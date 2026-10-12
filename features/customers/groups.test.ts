// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Types, type ObjectId } from '@/lib/mongoose';
import { clearTestDb, startTestDb, stopTestDb, syncIndexes } from '@/tests/db';
import { NO_ACCESS, type SessionUser } from '@/lib/permissions';
import { Customer } from '@/models/customer';

vi.mock('@/lib/db', () => ({ connectDb: () => Promise.resolve() }));

const { groupCustomers, listCustomers } = await import('./queries');

const TZ = 'Asia/Kolkata';
const ORG = new Types.ObjectId();

const admin: SessionUser = {
  id: new Types.ObjectId().toString(),
  orgId: ORG.toString(),
  name: 'Owner',
  role: 'admin',
  permissions: NO_ACCESS,
  mustChangePassword: false,
};

const NO_FILTERS = { dues: false, duesBracket: null, recency: null, city: null };

beforeAll(async () => {
  await startTestDb();
  await syncIndexes([Customer]);
}, 180_000);
afterEach(clearTestDb);
afterAll(stopTestDb);

let phone = 9_000_000_000;
async function seed(
  name: string,
  values: {
    city?: string | null;
    duePaise?: number;
    lastSaleAt?: Date | null;
    orgId?: ObjectId;
  },
) {
  phone += 1;
  await Customer.create({
    orgId: values.orgId ?? ORG,
    name,
    phones: [String(phone)],
    city: values.city ?? null,
    billedPaise: 100_000,
    paidPaise: 100_000 - (values.duePaise ?? 0),
    duePaise: values.duePaise ?? 0,
    bricksBought: 1_000,
    saleCount: 1,
    lastSaleAt: values.lastSaleAt ?? null,
    createdBy: new Types.ObjectId(),
  });
}

describe('groupCustomers', () => {
  it('groups by city, with customers without one together', async () => {
    await seed('A', { city: 'Jaipur' });
    await seed('B', { city: 'Jaipur' });
    await seed('C', { city: null });
    await seed('Elsewhere', { city: 'Jaipur', orgId: new Types.ObjectId() });

    const rows = await groupCustomers(admin, NO_FILTERS, '', TZ, 'city');
    expect(rows.map((row) => [row.key, row.customers])).toEqual([
      ['Jaipur', 2],
      ['—', 1],
    ]);
  });

  it('puts dues into brackets, in bracket order', async () => {
    await seed('Settled', { duePaise: 0 });
    await seed('Small', { duePaise: 500_000 });
    await seed('Medium', { duePaise: 2_000_000 });
    await seed('Large', { duePaise: 9_000_000 });

    const rows = await groupCustomers(admin, NO_FILTERS, '', TZ, 'dues');
    expect(rows.map((row) => [row.key, row.customers])).toEqual([
      ['none', 1],
      ['upto10k', 1],
      ['from10kTo50k', 1],
      ['over50k', 1],
    ]);

    // The bracket a group links to filters the list to exactly those customers.
    const page = await listCustomers(
      admin,
      {
        ...NO_FILTERS,
        duesBracket: 'from10kTo50k',
        q: '',
        sort: 'name',
        dir: 'asc',
        after: null,
        before: null,
        size: 25,
      },
      TZ,
    );
    expect(page.rows.map((row) => row.name)).toEqual(['Medium']);
  });

  it('groups by how recently they bought, counting those who never did', async () => {
    await seed('Recent', { lastSaleAt: new Date() });
    await seed('Old', { lastSaleAt: new Date('2020-01-01T00:00:00Z') });
    await seed('Never', { lastSaleAt: null });

    const rows = await groupCustomers(admin, NO_FILTERS, '', TZ, 'recency');
    expect(rows.map((row) => row.key)).toEqual(['thisMonth', 'older', 'never']);
  });
});

describe('listCustomers by last purchase', () => {
  it('lists only people who have bought when sorted by last purchase', async () => {
    await seed('Recent', { lastSaleAt: new Date() });
    await seed('Never', { lastSaleAt: null });
    const page = await listCustomers(
      admin,
      {
        ...NO_FILTERS,
        q: '',
        sort: 'lastSaleAt',
        dir: 'desc',
        after: null,
        before: null,
        size: 25,
      },
      TZ,
    );
    expect(page.rows.map((row) => row.name)).toEqual(['Recent']);
  });
});
