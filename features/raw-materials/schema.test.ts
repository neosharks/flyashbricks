import { describe, expect, it } from 'vitest';
import {
  AdjustMaterialSchema,
  CreateMaterialSchema,
  PurchaseSchema,
  UpdateMaterialSchema,
} from './schema';

const id = '0123456789abcdef01234567';

describe('CreateMaterialSchema', () => {
  it('parses a form submission into milli-units', () => {
    const parsed = CreateMaterialSchema.parse({
      name: 'Cement',
      kind: 'cement',
      unit: 'bag',
      lowThresholdMilli: '20',
      capacityMilli: '',
      openingMilli: '150.5',
      isActive: 'on',
    });
    expect(parsed.lowThresholdMilli).toBe(20_000);
    expect(parsed.capacityMilli).toBeNull();
    expect(parsed.openingMilli).toBe(150_500);
    expect(parsed.isActive).toBe(true);
  });

  it('rejects unknown units, kinds and extra fields', () => {
    const base = { name: 'Ash', kind: 'fly_ash', unit: 'kg', lowThresholdMilli: '1' };
    expect(CreateMaterialSchema.safeParse({ ...base, unit: 'barrel' }).success).toBe(false);
    expect(CreateMaterialSchema.safeParse({ ...base, kind: 'gold' }).success).toBe(false);
    expect(CreateMaterialSchema.safeParse({ ...base, quantityMilli: '5' }).success).toBe(false);
  });

  it('does not let an update change the stored balance', () => {
    expect(
      UpdateMaterialSchema.safeParse({
        id,
        name: 'Ash',
        kind: 'fly_ash',
        lowThresholdMilli: '1',
        quantityMilli: '99',
      }).success,
    ).toBe(false);
  });
});

describe('PurchaseSchema', () => {
  it('needs a positive quantity and a rupee cost', () => {
    const base = { materialId: id, qtyMilli: '50', costPaise: '19,000', date: '2026-10-01' };
    expect(PurchaseSchema.parse(base).costPaise).toBe(1_900_000);
    expect(PurchaseSchema.safeParse({ ...base, qtyMilli: '0' }).success).toBe(false);
    expect(PurchaseSchema.safeParse({ ...base, date: '01/10/2026' }).success).toBe(false);
  });
});

describe('AdjustMaterialSchema', () => {
  const base = { materialId: id, reason: 'Stock count', date: '2026-10-01' };

  it('allows setting a counted quantity of zero', () => {
    expect(AdjustMaterialSchema.safeParse({ ...base, mode: 'set', qtyMilli: '0' }).success).toBe(
      true,
    );
  });

  it('refuses a zero add or remove', () => {
    expect(AdjustMaterialSchema.safeParse({ ...base, mode: 'remove', qtyMilli: '0' }).success).toBe(
      false,
    );
  });

  it('requires a reason', () => {
    expect(
      AdjustMaterialSchema.safeParse({ ...base, reason: '', mode: 'add', qtyMilli: '5' }).success,
    ).toBe(false);
  });
});

describe('material names in two scripts', () => {
  const form = {
    kind: 'cement',
    unit: 'bag',
    lowThresholdMilli: '20',
    capacityMilli: '',
    openingMilli: '',
    isActive: 'on',
  };

  it('fills the Hindi name from English', () => {
    expect(CreateMaterialSchema.parse({ ...form, name: 'Cement' }).nameHi).toBe('सीमेंट');
  });

  it('rejects each box typed in the wrong script', () => {
    const result = CreateMaterialSchema.safeParse({ ...form, name: 'सीमेंट', nameHi: 'Cement' });
    const issues = result.error?.issues.map((issue) => `${issue.path.join('.')}:${issue.message}`);
    expect(issues).toEqual(expect.arrayContaining(['name:mustBeEnglish', 'nameHi:mustBeHindi']));
  });
});
