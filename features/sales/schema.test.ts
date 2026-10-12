import { describe, expect, it } from 'vitest';
import { CreateSaleSchema, foldLines } from './schema';

const PRODUCT_A = '64b7f0c2a1b2c3d4e5f60718';
const PRODUCT_B = '64b7f0c2a1b2c3d4e5f60719';

const form = {
  customerMode: 'existing',
  customerId: '64b7f0c2a1b2c3d4e5f60001',
  newCustomerName: '',
  newCustomerPhone: '',
  date: '2026-10-12',
  'lines.0.productId': PRODUCT_A,
  'lines.0.qty': '2,000',
  'lines.0.rate': '6.50',
  'lines.1.productId': PRODUCT_B,
  'lines.1.qty': '500',
  'lines.1.rate': '7',
  delivery: '1,500',
  discount: '',
  vehicleNo: 'rj14 ab 1234',
  deliveryAddress: '',
  note: '',
  paymentAmount: '',
  paymentMode: 'cash',
};

describe('foldLines', () => {
  it('turns flat line fields into ordered rows', () => {
    const folded = foldLines({ 'lines.1.qty': '5', 'lines.0.qty': '3', other: 'x' });
    expect(folded).toEqual({ other: 'x', lines: [{ qty: '3' }, { qty: '5' }] });
  });

  it('leaves unrelated or malformed line keys for the strict schema to reject', () => {
    expect(foldLines({ 'lines.0.total': '1' })).toEqual({ 'lines.0.total': '1', lines: [] });
  });
});

describe('CreateSaleSchema', () => {
  it('parses quantities and rupee rates into integers', () => {
    const parsed = CreateSaleSchema.parse(foldLines(form));
    expect(parsed.lines).toEqual([
      { productId: PRODUCT_A, qty: 2000, rate: 650 },
      { productId: PRODUCT_B, qty: 500, rate: 700 },
    ]);
    expect(parsed.delivery).toBe(150_000);
    expect(parsed.discount).toBe(0);
    expect(parsed.paymentAmount).toBe(0);
  });

  it('needs at least one line', () => {
    const result = CreateSaleSchema.safeParse({ ...foldLines(form), lines: [] });
    expect(result.error?.issues[0]?.message).toBe('atLeastOneLine');
  });

  it('flags a brick type listed twice on the repeating row', () => {
    const result = CreateSaleSchema.safeParse(
      foldLines({ ...form, 'lines.1.productId': PRODUCT_A }),
    );
    expect(result.error?.issues[0]?.path).toEqual(['lines', 1, 'productId']);
  });

  it('requires a name and phone for a new customer', () => {
    const result = CreateSaleSchema.safeParse(foldLines({ ...form, customerMode: 'new' }));
    const paths = result.error?.issues.map((issue) => issue.path.join('.'));
    expect(paths).toEqual(['newCustomerName', 'newCustomerPhone']);
  });

  it('rejects a client-supplied total, which the server always computes itself', () => {
    expect(CreateSaleSchema.safeParse(foldLines({ ...form, totalPaise: '1' })).success).toBe(false);
  });

  it('rejects zero quantities and fractional bricks', () => {
    expect(CreateSaleSchema.safeParse(foldLines({ ...form, 'lines.0.qty': '0' })).success).toBe(
      false,
    );
    expect(CreateSaleSchema.safeParse(foldLines({ ...form, 'lines.0.qty': '1.5' })).success).toBe(
      false,
    );
  });
});
