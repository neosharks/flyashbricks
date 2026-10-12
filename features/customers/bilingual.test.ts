// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Types } from '@/lib/mongoose';
import { clearTestDb, startTestDb, stopTestDb, syncIndexes } from '@/tests/db';
import { NO_ACCESS, type SessionUser } from '@/lib/permissions';
import { Customer } from '@/models/customer';
import { createCustomer } from './service';
import { CreateCustomerSchema } from './schema';
import { customerSearchFilter, toCustomerRow } from './queries';
import { customerCsvColumns } from './csv-columns';

beforeAll(async () => {
  await startTestDb();
  await syncIndexes([Customer]);
}, 180_000);
afterEach(clearTestDb);
afterAll(stopTestDb);

const actor: SessionUser = {
  id: new Types.ObjectId().toString(),
  orgId: new Types.ObjectId().toString(),
  name: 'Clerk',
  role: 'admin',
  permissions: NO_ACCESS,
  mustChangePassword: false,
};

async function seed() {
  return createCustomer(
    actor,
    CreateCustomerSchema.parse({
      name: 'Ramesh Kumar',
      nameHi: 'रमेश कुमार',
      phones: ['9876543210'],
      city: 'Jaipur',
      gstin: '',
      stateCode: '',
    }),
  );
}

describe('customers in two scripts', () => {
  it('are found by a search in either script', async () => {
    await seed();
    for (const q of ['ramesh', 'Kumar', 'रमेश', 'जयपुर', '98765']) {
      const filter = customerSearchFilter(q);
      expect(await Customer.countDocuments(filter ?? {}), q).toBe(1);
    }
  });
});

describe('toCustomerRow', () => {
  it('picks the reader’s language and falls back to the other', async () => {
    const created = await seed();
    const doc = await Customer.findById(created._id).lean();
    if (!doc) throw new Error('expected a customer');

    expect(toCustomerRow(doc, 'hi').name).toBe('रमेश कुमार');
    expect(toCustomerRow(doc, 'hi').city).toBe('जयपुर');
    expect(toCustomerRow(doc, 'en').name).toBe('Ramesh Kumar');
    expect(toCustomerRow(doc, 'hi')).toMatchObject({
      nameEn: 'Ramesh Kumar',
      nameHi: 'रमेश कुमार',
    });
    expect(toCustomerRow({ ...doc, nameHi: null }, 'hi').name).toBe('Ramesh Kumar');
  });
});

describe('customer CSV', () => {
  it('exports the name, city and address in both scripts', async () => {
    const created = await seed();
    const doc = await Customer.findById(created._id).lean();
    if (!doc) throw new Error('expected a customer');

    const label = (key: string) => key;
    const inHindi = (_key: string, values?: Record<string, string | number>) =>
      `${String(values?.label)} (Hindi)`;
    const { header, toRow } = customerCsvColumns(label, inHindi, 'Asia/Kolkata');

    expect(header.slice(0, 2)).toEqual(['columns.name', 'columns.name (Hindi)']);
    const row = toRow(doc);
    expect(row[0]).toBe('Ramesh Kumar');
    expect(row[1]).toBe('रमेश कुमार');
    expect(row[header.indexOf('columns.city (Hindi)')]).toBe('जयपुर');
  });
});
