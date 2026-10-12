// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from '@/lib/mongoose';
import { clearTestDb, startTestDb, stopTestDb, syncIndexes } from '@/tests/db';
import { NO_ACCESS, type SessionUser } from '@/lib/permissions';
import { Customer } from '@/models/customer';
import { Counter } from '@/models/counter';
import { Organization } from '@/models/organization';
import { Product } from '@/models/product';
import { Sale } from '@/models/sale';
import { StockMovement } from '@/models/stock-movement';
import { createCustomer } from '@/features/customers/service';
import type { SalesFilters } from './filters';
import type { CreateSaleInput } from './schema';

// The queries connect through the app's connector; the test owns the connection.
vi.mock('@/lib/db', () => ({ connectDb: () => Promise.resolve() }));

const { addPayment, createSale } = await import('./service');
const { customerPriceStats, groupSales, listCustomerPayments } = await import('./queries');
const { backfillSaleRates } = await import('./migrations');

const TZ = 'Asia/Kolkata';
const ORG = new Types.ObjectId().toString();
const OTHER_ORG = new Types.ObjectId().toString();

function adminOf(orgId: string): SessionUser {
  return {
    id: new Types.ObjectId().toString(),
    orgId,
    name: 'Owner',
    role: 'admin',
    permissions: NO_ACCESS,
    mustChangePassword: false,
  };
}
const admin = adminOf(ORG);

const NO_FILTERS: SalesFilters = {
  range: null,
  from: null,
  to: null,
  status: null,
  customerId: null,
  productId: null,
  rateBand: null,
};

beforeAll(async () => {
  await startTestDb();
  await syncIndexes([Customer, Product, Sale, StockMovement, Counter]);
}, 180_000);
beforeEach(async () => {
  for (const id of [ORG, OTHER_ORG]) {
    await Organization.create({ _id: new Types.ObjectId(id), name: 'Yard', stateCode: '08' });
  }
});
afterEach(clearTestDb);
afterAll(stopTestDb);

async function seedProduct(orgId = ORG, defaultRatePaise = 650, name = 'Standard') {
  const product = await Product.create({
    orgId: new Types.ObjectId(orgId),
    name: `${name} ${new Types.ObjectId().toString().slice(-4)}`,
    stockGood: 1_000_000,
    defaultRatePaise,
  });
  return product._id.toString();
}

async function seedCustomer(actor: SessionUser, name: string, phone: string) {
  const customer = await createCustomer(actor, {
    name,
    nameHi: null,
    phones: [phone],
    address: null,
    addressHi: null,
    city: 'Jaipur',
    cityHi: null,
    gstin: null,
    stateCode: null,
    notes: null,
  });
  return customer._id.toString();
}

function input(
  customerId: string,
  lines: CreateSaleInput['lines'],
  overrides: Partial<CreateSaleInput> = {},
): CreateSaleInput {
  return {
    customerMode: 'existing',
    customerId,
    newCustomerName: null,
    newCustomerNameHi: null,
    newCustomerPhone: undefined,
    date: '2026-10-01',
    lines,
    delivery: 0,
    discount: 0,
    vehicleNo: null,
    deliveryAddress: null,
    note: null,
    paymentAmount: 0,
    paymentMode: 'cash',
    ...overrides,
  };
}

describe('price per brick on a sale', () => {
  it('records the charged rate, the usual price and the average per brick', async () => {
    const standard = await seedProduct(ORG, 650);
    const premium = await seedProduct(ORG, 900, 'Premium');
    const customer = await seedCustomer(admin, 'Ramesh', '9876543210');

    const { id } = await createSale(
      admin,
      input(
        customer,
        [
          { productId: standard, qty: 3_000, rate: 600 },
          { productId: premium, qty: 1_000, rate: 950 },
        ],
        { delivery: 50_000, discount: 10_000 },
      ),
      TZ,
    );

    const sale = await Sale.findById(id).lean();
    expect(sale?.lines.map((line) => [line.ratePaise, line.defaultRatePaise])).toEqual([
      [600, 650],
      [950, 900],
    ]);
    // Goods only: (3000 × 6.00 + 1000 × 9.50) / 4000 bricks — delivery and discount excluded.
    expect(sale?.avgRatePaise).toBe(Math.round((3_000 * 600 + 1_000 * 950) / 4_000));
  });
});

describe('backfillSaleRates', () => {
  it('fills in old sales once, and leaves them alone on a second run', async () => {
    const sales = mongoose.connection.collection('sales');
    await sales.insertOne({
      orgId: new Types.ObjectId(ORG),
      number: 1,
      subtotalPaise: 1_300_000,
      bricks: 2_000,
      lines: [
        {
          productId: new Types.ObjectId(),
          productName: 'Old',
          qty: 2_000,
          ratePaise: 650,
          amountPaise: 1_300_000,
        },
      ],
    });

    expect(await backfillSaleRates(sales)).toBe(1);
    const sale = await sales.findOne({ number: 1 });
    expect(sale?.avgRatePaise).toBe(650);
    expect((sale?.lines as { defaultRatePaise: number }[])[0]?.defaultRatePaise).toBe(650);

    expect(await backfillSaleRates(sales)).toBe(0);
  });
});

describe('groupSales', () => {
  async function seedMonth() {
    const product = await seedProduct();
    const ramesh = await seedCustomer(admin, 'Ramesh', '9876543210');
    const suresh = await seedCustomer(admin, 'Suresh', '9876543211');
    await createSale(
      admin,
      input(ramesh, [{ productId: product, qty: 1_000, rate: 650 }], {
        date: '2026-10-01',
        paymentAmount: 650_000,
      }),
      TZ,
    );
    await createSale(
      admin,
      input(ramesh, [{ productId: product, qty: 2_000, rate: 600 }], { date: '2026-10-01' }),
      TZ,
    );
    await createSale(
      admin,
      input(suresh, [{ productId: product, qty: 500, rate: 700 }], { date: '2026-10-03' }),
      TZ,
    );

    // Another company's sale must never appear in this company's groups.
    const other = adminOf(OTHER_ORG);
    const theirProduct = await seedProduct(OTHER_ORG);
    const theirCustomer = await seedCustomer(other, 'Elsewhere', '9876543299');
    await createSale(
      other,
      input(theirCustomer, [{ productId: theirProduct, qty: 9_000, rate: 500 }]),
      TZ,
    );

    return { product, ramesh, suresh };
  }

  it('adds up each day correctly, newest first', async () => {
    await seedMonth();
    const days = await groupSales(admin, NO_FILTERS, '', TZ, 'day');
    expect(days.map((row) => [row.key, row.bills, row.bricks])).toEqual([
      ['2026-10-03', 1, 500],
      ['2026-10-01', 2, 3_000],
    ]);
    expect(days[1]?.totalPaise).toBe(650_000 + 1_200_000);
    expect(days[1]?.paidPaise).toBe(650_000);
    expect(days[1]?.duePaise).toBe(1_200_000);
  });

  it('groups by customer with names, and by price band', async () => {
    const { ramesh } = await seedMonth();
    const byCustomer = await groupSales(admin, NO_FILTERS, '', TZ, 'customer');
    expect(byCustomer.find((row) => row.key === ramesh)).toMatchObject({
      name: 'Ramesh',
      bills: 2,
      bricks: 3_000,
    });

    const byPrice = await groupSales(admin, NO_FILTERS, '', TZ, 'price');
    expect(byPrice.map((row) => [row.key, row.bills])).toEqual([
      ['600', 1],
      ['650', 1],
      ['700', 1],
    ]);
  });

  it('splits by brick type from the lines, and honours a price filter', async () => {
    const { product } = await seedMonth();
    const byProduct = await groupSales(admin, NO_FILTERS, '', TZ, 'product');
    expect(byProduct).toHaveLength(1);
    expect(byProduct[0]).toMatchObject({ key: product, bricks: 3_500, totalPaise: null });

    const cheap = await groupSales(admin, { ...NO_FILTERS, rateBand: 600 }, '', TZ, 'day');
    expect(cheap.reduce((sum, row) => sum + row.bills, 0)).toBe(1);
  });
});

describe('customer price and payments', () => {
  it('reports their usual price and the last price they paid', async () => {
    const product = await seedProduct();
    const customer = await seedCustomer(admin, 'Ramesh', '9876543210');
    await createSale(
      admin,
      input(customer, [{ productId: product, qty: 1_000, rate: 600 }], { date: '2026-10-01' }),
      TZ,
    );
    await createSale(
      admin,
      input(customer, [{ productId: product, qty: 3_000, rate: 700 }], { date: '2026-10-02' }),
      TZ,
    );

    const stats = await customerPriceStats(admin, customer);
    expect(stats.avgRatePaise).toBe(675);
    expect(stats.lastRatePaise).toBe(700);
  });

  it('pages through money received without repeating or skipping anything', async () => {
    const product = await seedProduct();
    const customer = await seedCustomer(admin, 'Ramesh', '9876543210');
    const { id } = await createSale(
      admin,
      input(customer, [{ productId: product, qty: 10_000, rate: 650 }]),
      TZ,
    );
    for (let day = 2; day <= 8; day += 1) {
      await addPayment(
        admin,
        { saleId: id, amount: 10_000 * day, mode: 'cash', date: `2026-10-0${day}`, note: null },
        TZ,
      );
    }

    const seen: number[] = [];
    let after: string | null = null;
    for (let page = 0; page < 5; page += 1) {
      const result = await listCustomerPayments(admin, customer, {
        q: '',
        sort: 'paidAt',
        dir: 'desc',
        after,
        before: null,
        size: 3,
      });
      seen.push(...result.rows.map((row) => row.amountPaise));
      if (!result.next) break;
      after = result.next;
    }
    expect(seen).toEqual([80_000, 70_000, 60_000, 50_000, 40_000, 30_000, 20_000]);

    // Paging back from the second page returns exactly the first.
    const first = await listCustomerPayments(admin, customer, {
      q: '',
      sort: 'paidAt',
      dir: 'desc',
      after: null,
      before: null,
      size: 3,
    });
    const second = await listCustomerPayments(admin, customer, {
      q: '',
      sort: 'paidAt',
      dir: 'desc',
      after: first.next,
      before: null,
      size: 3,
    });
    const back = await listCustomerPayments(admin, customer, {
      q: '',
      sort: 'paidAt',
      dir: 'desc',
      after: null,
      before: second.prev,
      size: 3,
    });
    expect(back.rows.map((row) => row.id)).toEqual(first.rows.map((row) => row.id));
    expect(back.prev).toBeNull();

    const largest = await listCustomerPayments(admin, customer, {
      q: '',
      sort: 'amountPaise',
      dir: 'desc',
      after: null,
      before: null,
      size: 2,
    });
    expect(largest.rows.map((row) => row.amountPaise)).toEqual([80_000, 70_000]);

    // Another company's admin sees nothing for this customer id.
    const stranger = await listCustomerPayments(adminOf(OTHER_ORG), customer, {
      q: '',
      sort: 'paidAt',
      dir: 'desc',
      after: null,
      before: null,
      size: 10,
    });
    expect(stranger.rows).toEqual([]);
  });
});
