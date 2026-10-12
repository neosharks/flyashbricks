// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from '@/lib/mongoose';
import { clearTestDb, startTestDb, stopTestDb } from '@/tests/db';
import { backfillHindiNames } from './backfill-hindi';

beforeAll(startTestDb, 180_000);
afterEach(clearTestDb);
afterAll(stopTestDb);

function db() {
  const connection = mongoose.connection.db;
  if (!connection) throw new Error('not connected');
  return connection;
}

/** Documents as they were stored before the Hindi fields existed. */
async function seedLegacy() {
  const customerId = new Types.ObjectId();
  const productId = new Types.ObjectId();
  await db()
    .collection('customers')
    .insertOne({
      _id: customerId,
      name: 'Ramesh Kumar',
      city: 'Jaipur',
      address: null,
      phones: ['9876543210'],
      searchTerms: ['ramesh', 'kumar'],
    });
  await db().collection('products').insertOne({ _id: productId, name: 'Fly ash brick' });
  await db().collection('raw_materials').insertOne({ name: 'Cement (OPC 43)' });
  await db()
    .collection('organizations')
    .insertOne({ name: 'Shree Bricks', legalName: null, address: 'NH 48' });
  await db()
    .collection('sales')
    .insertOne({
      customerId,
      customerName: 'Ramesh Kumar',
      seller: { name: 'Shree Bricks', address: 'NH 48' },
      buyer: { name: 'Ramesh Kumar', address: null },
      lines: [{ productId, productName: 'Fly ash brick', qty: 100 }],
    });
  await db()
    .collection('production_entries')
    .insertOne({ productId, productName: 'Fly ash brick' });
  return { customerId };
}

describe('backfillHindiNames', () => {
  it('fills every missing Hindi field from the English one', async () => {
    await seedLegacy();
    const counts = await backfillHindiNames(db());

    expect(counts).toMatchObject({
      customers: 1,
      products: 1,
      rawMaterials: 1,
      organizations: 1,
      sales: 1,
      productionEntries: 1,
    });
    const customer = await db().collection('customers').findOne();
    expect(customer?.nameHi).toBe('रमेश कुमार');
    expect(customer?.cityHi).toBe('जयपुर');
    expect(customer?.addressHi).toBeNull();
    // Search now finds the customer in Hindi too.
    expect(customer?.searchTerms).toEqual(expect.arrayContaining(['रमेश', 'ramesh']));

    const material = await db().collection('raw_materials').findOne();
    expect(material?.nameHi).toBe('सीमेंट (OPC 43)');
  });

  it('gives copies on sales and production the record’s own Hindi name', async () => {
    const { customerId } = await seedLegacy();
    await db()
      .collection('customers')
      .updateOne({ _id: customerId }, { $set: { nameHi: 'रमेश जी' } });
    await db()
      .collection('products')
      .updateOne({}, { $set: { nameHi: 'फ्लाई ऐश ईंट' } });

    await backfillHindiNames(db());

    const sale = await db().collection('sales').findOne();
    expect(sale?.customerNameHi).toBe('रमेश जी');
    const typed = sale as {
      buyer: { nameHi: string };
      seller: { nameHi: string };
      lines: { productNameHi: string }[];
    } | null;
    expect(typed?.buyer.nameHi).toBe('रमेश जी');
    expect(typed?.lines[0]?.productNameHi).toBe('फ्लाई ऐश ईंट');
    expect(typed?.seller.nameHi).toBeTruthy();
    const entry = await db().collection('production_entries').findOne();
    expect(entry?.productNameHi).toBe('फ्लाई ऐश ईंट');
  });

  it('does nothing the second time, and never overwrites a corrected spelling', async () => {
    const { customerId } = await seedLegacy();
    await backfillHindiNames(db());
    await db()
      .collection('customers')
      .updateOne({ _id: customerId }, { $set: { nameHi: 'रमेश कुमार जी' } });

    const again = await backfillHindiNames(db());
    expect(Object.values(again).every((count) => count === 0)).toBe(true);
    expect((await db().collection('customers').findOne())?.nameHi).toBe('रमेश कुमार जी');
  });
});
