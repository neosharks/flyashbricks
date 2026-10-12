// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Types } from '@/lib/mongoose';
import { clearTestDb, startTestDb, stopTestDb, syncIndexes } from '@/tests/db';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { NO_ACCESS, type SessionUser } from '@/lib/permissions';
import { Customer } from '@/models/customer';
import { Counter } from '@/models/counter';
import { Product } from '@/models/product';
import { Sale } from '@/models/sale';
import { StockMovement } from '@/models/stock-movement';
import { AuditLog } from '@/models/audit-log';
import { Organization } from '@/models/organization';
import { createCustomer, PhoneTakenError } from '@/features/customers/service';
import { addPayment, createSale, voidSale } from './service';
import type { CreateSaleInput } from './schema';

const TZ = 'Asia/Kolkata';
const ORG = new Types.ObjectId().toString();

const admin: SessionUser = {
  id: new Types.ObjectId().toString(),
  orgId: ORG,
  name: 'Owner',
  role: 'admin',
  permissions: NO_ACCESS,
  mustChangePassword: false,
};

const clerk: SessionUser = {
  ...admin,
  id: new Types.ObjectId().toString(),
  name: 'Clerk',
  role: 'employee',
  permissions: { ...NO_ACCESS, sales: 'write' },
};

const viewer: SessionUser = { ...clerk, permissions: { ...NO_ACCESS, sales: 'read' } };

beforeAll(async () => {
  await startTestDb();
  await syncIndexes([Customer, Product, Sale, StockMovement, Counter]);
}, 180_000);
beforeEach(async () => {
  await Organization.create({
    _id: new Types.ObjectId(ORG),
    name: 'Shree Bricks',
    stateCode: '08',
  });
});
afterEach(clearTestDb);
afterAll(stopTestDb);

async function seedProduct(stockGood: number, orgId = ORG) {
  const product = await Product.create({
    orgId: new Types.ObjectId(orgId),
    name: `Brick ${new Types.ObjectId().toString()}`,
    stockGood,
    defaultRatePaise: 650,
  });
  return product._id.toString();
}

async function seedCustomer(
  actor = admin,
  phone = '9876543210',
  stateCode: '08' | '27' | null = null,
) {
  const customer = await createCustomer(actor, {
    name: 'Ramesh Builders',
    nameHi: null,
    phones: [phone],
    address: null,
    addressHi: null,
    city: 'Jaipur',
    cityHi: null,
    gstin: null,
    stateCode,
    notes: null,
  });
  return customer._id.toString();
}

function saleInput(
  customerId: string,
  productId: string,
  overrides: Partial<CreateSaleInput> = {},
): CreateSaleInput {
  return {
    customerMode: 'existing',
    customerId,
    newCustomerName: null,
    newCustomerNameHi: null,
    newCustomerPhone: undefined,
    date: '2026-10-01',
    lines: [{ productId, qty: 1000, rate: 650 }],
    delivery: 50_000,
    discount: 0,
    vehicleNo: null,
    deliveryAddress: null,
    note: null,
    paymentAmount: 0,
    paymentMode: 'cash',
    ...overrides,
  };
}

async function customerTotals(id: string) {
  const customer = await Customer.findById(id).lean();
  return {
    billed: customer?.billedPaise,
    paid: customer?.paidPaise,
    due: customer?.duePaise,
    bricks: customer?.bricksBought,
    count: customer?.saleCount,
  };
}

describe('createSale', () => {
  it('takes the bricks, numbers the sale and bills the customer in one go', async () => {
    const productId = await seedProduct(5000);
    const customerId = await seedCustomer();

    const first = await createSale(
      clerk,
      saleInput(customerId, productId, { paymentAmount: 200_000 }),
      TZ,
    );
    const second = await createSale(clerk, saleInput(customerId, productId), TZ);

    expect([first.number, second.number]).toEqual([1, 2]);
    expect((await Product.findById(productId).lean())?.stockGood).toBe(3000);

    const sale = await Sale.findById(first.id).lean();
    expect(sale).toMatchObject({
      subtotalPaise: 650_000,
      totalPaise: 700_000,
      paidPaise: 200_000,
      duePaise: 500_000,
      status: 'partial',
      bricks: 1000,
    });
    expect(await customerTotals(customerId)).toEqual({
      billed: 1_400_000,
      paid: 200_000,
      due: 1_200_000,
      bricks: 2000,
      count: 2,
    });
    expect(await AuditLog.countDocuments({ action: 'sale.create' })).toBe(2);
  });

  it('creates a new customer in the same transaction when asked to', async () => {
    const productId = await seedProduct(100);
    await createSale(
      clerk,
      saleInput('', productId, {
        customerMode: 'new',
        customerId: undefined,
        newCustomerName: 'Walk-in Mason',
        newCustomerPhone: '9123456780',
        lines: [{ productId, qty: 100, rate: 700 }],
        delivery: 0,
      }),
      TZ,
    );
    const customer = await Customer.findOne({ phones: '9123456780' }).lean();
    expect(customer?.name).toBe('Walk-in Mason');
    expect(customer?.saleCount).toBe(1);
    expect(customer?.searchTerms).toContain('mason');
  });

  it('freezes both scripts of every name onto the bill and its invoice', async () => {
    await Organization.updateOne(
      { _id: ORG },
      { $set: { nameHi: 'श्री ब्रिक्स', address: 'NH 48', addressHi: 'एनएच 48' } },
    );
    const productId = await seedProduct(100);
    await Product.updateOne({ _id: productId }, { $set: { nameHi: 'फ्लाई ऐश ईंट' } });
    await createSale(
      clerk,
      saleInput('', productId, {
        customerMode: 'new',
        customerId: undefined,
        newCustomerName: null,
        newCustomerNameHi: 'रमेश',
        newCustomerPhone: '9123456781',
        lines: [{ productId, qty: 100, rate: 700 }],
        delivery: 0,
      }),
      TZ,
    );

    const sale = await Sale.findOne().lean();
    // Typed only in Hindi: the English name is filled in for sorting and the invoice.
    expect(sale?.customerName).toBe('Ramesh');
    expect(sale?.customerNameHi).toBe('रमेश');
    expect(sale?.buyer).toMatchObject({ name: 'Ramesh', nameHi: 'रमेश' });
    expect(sale?.seller).toMatchObject({ nameHi: 'श्री ब्रिक्स', addressHi: 'एनएच 48' });
    expect(sale?.lines[0]?.productNameHi).toBe('फ्लाई ऐश ईंट');
  });

  it('points at the line that asks for more bricks than are in stock', async () => {
    const productId = await seedProduct(10);
    const customerId = await seedCustomer();
    await expect(createSale(clerk, saleInput(customerId, productId), TZ)).rejects.toMatchObject({
      fields: { 'lines.0.qty': ['notEnoughStock'] },
    });
  });

  it('does not oversell when two sales race for the last bricks', async () => {
    const productId = await seedProduct(1500);
    const customerId = await seedCustomer();

    const results = await Promise.allSettled([
      createSale(clerk, saleInput(customerId, productId), TZ),
      createSale(clerk, saleInput(customerId, productId), TZ),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await Product.findById(productId).lean())?.stockGood).toBe(500);
    expect(await Sale.countDocuments()).toBe(1);
    expect((await customerTotals(customerId)).count).toBe(1);
  });

  it('refuses a future date, an oversized payment and a discount bigger than the bill', async () => {
    const productId = await seedProduct(5000);
    const customerId = await seedCustomer();
    await expect(
      createSale(clerk, saleInput(customerId, productId, { date: '2999-01-01' }), TZ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createSale(clerk, saleInput(customerId, productId, { paymentAmount: 700_001 }), TZ),
    ).rejects.toMatchObject({ fields: { paymentAmount: ['paymentTooLarge'] } });
    await expect(
      createSale(clerk, saleInput(customerId, productId, { discount: 700_001 }), TZ),
    ).rejects.toMatchObject({ fields: { discount: ['discountTooLarge'] } });
    expect((await Product.findById(productId).lean())?.stockGood).toBe(5000);
  });

  it('refuses someone with view-only access', async () => {
    const productId = await seedProduct(5000);
    const customerId = await seedCustomer();
    await expect(createSale(viewer, saleInput(customerId, productId), TZ)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('never sells another organisation’s bricks or bills its customer', async () => {
    const foreignProduct = await seedProduct(5000, new Types.ObjectId().toString());
    const customerId = await seedCustomer();
    await expect(
      createSale(clerk, saleInput(customerId, foreignProduct), TZ),
    ).rejects.toMatchObject({
      fields: { 'lines.0.productId': ['invalid'] },
    });

    const outsider: SessionUser = { ...admin, orgId: new Types.ObjectId().toString() };
    const ownProduct = await seedProduct(5000, outsider.orgId);
    await expect(
      createSale(outsider, saleInput(customerId, ownProduct), TZ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect((await customerTotals(customerId)).count).toBe(0);
  });
});

describe('invoices and GST', () => {
  it('numbers invoices per financial year and freezes the seller onto the sale', async () => {
    const productId = await seedProduct(5000);
    const customerId = await seedCustomer();
    const first = await createSale(clerk, saleInput(customerId, productId), TZ);
    const second = await createSale(clerk, saleInput(customerId, productId), TZ);

    const [a, b] = await Promise.all([
      Sale.findById(first.id).lean(),
      Sale.findById(second.id).lean(),
    ]);
    expect(a?.invoiceNumber).toBe('INV/2026-27/0001');
    expect(b?.invoiceNumber).toBe('INV/2026-27/0002');
    expect(a?.seller.name).toBe('Shree Bricks');
    expect(a?.buyer).toMatchObject({ name: 'Ramesh Builders', phone: '9876543210' });

    await Organization.updateOne({ _id: ORG }, { $set: { name: 'Renamed Later' } });
    expect((await Sale.findById(first.id).lean())?.seller.name).toBe('Shree Bricks');
  });

  it('charges no GST when the yard has no GSTIN', async () => {
    const productId = await seedProduct(5000);
    const customerId = await seedCustomer();
    const { id } = await createSale(clerk, saleInput(customerId, productId), TZ);
    expect(await Sale.findById(id).lean()).toMatchObject({
      taxPaise: 0,
      totalPaise: 700_000,
      taxablePaise: 700_000,
    });
  });

  it('splits GST into CGST and SGST within the state, and IGST across states', async () => {
    await Organization.updateOne(
      { _id: ORG },
      { $set: { gstin: '08AAPFU0939F1ZV', gstRateBps: 500 } },
    );
    const productId = await seedProduct(5000);
    const local = await seedCustomer(admin, '9876543210', null);
    const outOfState = await seedCustomer(admin, '9123456789', '27');

    const a = await createSale(clerk, saleInput(local, productId), TZ);
    const b = await createSale(clerk, saleInput(outOfState, productId), TZ);

    expect(await Sale.findById(a.id).lean()).toMatchObject({
      taxablePaise: 700_000,
      cgstPaise: 17_500,
      sgstPaise: 17_500,
      igstPaise: 0,
      totalPaise: 735_000,
      duePaise: 735_000,
    });
    expect(await Sale.findById(b.id).lean()).toMatchObject({
      igstPaise: 35_000,
      cgstPaise: 0,
      totalPaise: 735_000,
    });
    expect((await Customer.findById(local).lean())?.billedPaise).toBe(735_000);
  });

  it('lets the first payment cover tax but not more', async () => {
    await Organization.updateOne(
      { _id: ORG },
      { $set: { gstin: '08AAPFU0939F1ZV', gstRateBps: 500 } },
    );
    const productId = await seedProduct(5000);
    const customerId = await seedCustomer();
    await expect(
      createSale(clerk, saleInput(customerId, productId, { paymentAmount: 735_001 }), TZ),
    ).rejects.toMatchObject({ fields: { paymentAmount: ['paymentTooLarge'] } });
    const { id } = await createSale(
      clerk,
      saleInput(customerId, productId, { paymentAmount: 735_000 }),
      TZ,
    );
    expect((await Sale.findById(id).lean())?.status).toBe('paid');
  });
});

describe('addPayment', () => {
  it('settles the sale and the customer together', async () => {
    const productId = await seedProduct(5000);
    const customerId = await seedCustomer();
    const { id } = await createSale(clerk, saleInput(customerId, productId), TZ);

    await addPayment(
      clerk,
      { saleId: id, amount: 300_000, mode: 'upi', date: '2026-10-02', note: null },
      TZ,
    );
    await addPayment(
      clerk,
      { saleId: id, amount: 400_000, mode: 'cash', date: '2026-10-03', note: null },
      TZ,
    );

    const sale = await Sale.findById(id).lean();
    expect(sale).toMatchObject({ paidPaise: 700_000, duePaise: 0, status: 'paid' });
    expect(sale?.payments).toHaveLength(2);
    expect(await customerTotals(customerId)).toMatchObject({ paid: 700_000, due: 0 });
  });

  it('rejects a payment larger than what is due', async () => {
    const productId = await seedProduct(5000);
    const customerId = await seedCustomer();
    const { id } = await createSale(clerk, saleInput(customerId, productId), TZ);

    await expect(
      addPayment(
        clerk,
        { saleId: id, amount: 700_001, mode: 'cash', date: '2026-10-02', note: null },
        TZ,
      ),
    ).rejects.toMatchObject({ code: 'OVERPAYMENT' });
    expect((await customerTotals(customerId)).paid).toBe(0);
  });

  it('cannot be recorded against another organisation’s sale', async () => {
    const productId = await seedProduct(5000);
    const customerId = await seedCustomer();
    const { id } = await createSale(clerk, saleInput(customerId, productId), TZ);
    const outsider: SessionUser = { ...admin, orgId: new Types.ObjectId().toString() };

    await expect(
      addPayment(
        outsider,
        { saleId: id, amount: 100, mode: 'cash', date: '2026-10-02', note: null },
        TZ,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('voidSale', () => {
  it('returns the bricks and leaves customer totals as if the sale never happened', async () => {
    const productId = await seedProduct(5000);
    const customerId = await seedCustomer();
    const kept = await createSale(
      clerk,
      saleInput(customerId, productId, { date: '2026-09-20' }),
      TZ,
    );
    const { id } = await createSale(
      clerk,
      saleInput(customerId, productId, { paymentAmount: 100_000 }),
      TZ,
    );
    await addPayment(
      clerk,
      { saleId: id, amount: 50_000, mode: 'upi', date: '2026-10-02', note: null },
      TZ,
    );

    await voidSale(admin, { saleId: id, reason: 'Entered twice' });

    expect((await Product.findById(productId).lean())?.stockGood).toBe(4000);
    expect(await customerTotals(customerId)).toEqual({
      billed: 700_000,
      paid: 0,
      due: 700_000,
      bricks: 1000,
      count: 1,
    });
    const keptSale = await Sale.findById(kept.id).lean();
    expect((await Customer.findById(customerId).lean())?.lastSaleAt?.getTime()).toBe(
      keptSale?.date.getTime(),
    );
    expect(await StockMovement.countDocuments({ type: 'sale_void' })).toBe(1);
  });

  it('is admin-only and happens once', async () => {
    const productId = await seedProduct(5000);
    const customerId = await seedCustomer();
    const { id } = await createSale(clerk, saleInput(customerId, productId), TZ);

    await expect(voidSale(clerk, { saleId: id, reason: 'mistake' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await voidSale(admin, { saleId: id, reason: 'mistake' });
    await expect(voidSale(admin, { saleId: id, reason: 'again' })).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(
      addPayment(
        clerk,
        { saleId: id, amount: 100, mode: 'cash', date: '2026-10-02', note: null },
        TZ,
      ),
    ).rejects.toMatchObject({ code: 'ALREADY_VOIDED' });
  });
});

describe('customers', () => {
  it('will not give two customers in one organisation the same phone', async () => {
    await seedCustomer();
    await expect(seedCustomer(admin, '9876543210')).rejects.toBeInstanceOf(PhoneTakenError);
  });

  it('lets another organisation use the same phone number', async () => {
    await seedCustomer();
    const other: SessionUser = { ...admin, orgId: new Types.ObjectId().toString() };
    await expect(seedCustomer(other, '9876543210')).resolves.toBeTypeOf('string');
  });
});
