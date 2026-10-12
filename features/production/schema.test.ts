import { describe, expect, it } from 'vitest';
import { LogProductionSchema, VoidProductionSchema } from './schema';

const productId = '0123456789abcdef01234567';

describe('LogProductionSchema', () => {
  it('parses counts with separators and treats blank defective as zero', () => {
    const parsed = LogProductionSchema.parse({
      productId,
      date: '2026-10-12',
      goodQty: '4,800',
      defectiveQty: '',
    });
    expect(parsed.goodQty).toBe(4_800);
    expect(parsed.defectiveQty).toBe(0);
    expect(parsed.note).toBeNull();
  });

  it('allows a day of only defective bricks', () => {
    expect(
      LogProductionSchema.safeParse({
        productId,
        date: '2026-10-12',
        goodQty: '0',
        defectiveQty: '30',
      }).success,
    ).toBe(true);
  });

  it('refuses an entry with nothing made', () => {
    const result = LogProductionSchema.safeParse({
      productId,
      date: '2026-10-12',
      goodQty: '0',
      defectiveQty: '0',
    });
    expect(result.error?.issues[0]?.message).toBe('nothingProduced');
  });

  it('refuses negative or fractional counts and unknown fields', () => {
    const base = { productId, date: '2026-10-12', goodQty: '10' };
    expect(LogProductionSchema.safeParse({ ...base, goodQty: '-5' }).success).toBe(false);
    expect(LogProductionSchema.safeParse({ ...base, goodQty: '2.5' }).success).toBe(false);
    expect(LogProductionSchema.safeParse({ ...base, consumption: [] }).success).toBe(false);
  });
});

describe('VoidProductionSchema', () => {
  it('requires a reason', () => {
    expect(VoidProductionSchema.safeParse({ id: productId, reason: '' }).success).toBe(false);
    expect(VoidProductionSchema.safeParse({ id: productId, reason: 'Entered twice' }).success).toBe(
      true,
    );
  });
});
