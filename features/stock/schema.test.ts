import { describe, expect, it } from 'vitest';
import { AdjustStockSchema, CreateProductSchema, foldRecipe } from './schema';

const a = '0123456789abcdef01234567';
const b = '0123456789abcdef01234568';

const base = {
  name: 'Standard brick',
  size: '230 × 110 × 75 mm',
  defaultRatePaise: '6.50',
  recipeBatchSize: '100',
  lowStockThreshold: '5,000',
  isActive: 'on',
};

describe('foldRecipe + CreateProductSchema', () => {
  it('zips the editor rows into a recipe', () => {
    const parsed = CreateProductSchema.parse(
      foldRecipe({ ...base, recipe_materialId: [a, b], recipe_qty: ['150', '25.5'] }),
    );
    expect(parsed.recipe).toEqual([
      { materialId: a, qtyMilli: 150_000 },
      { materialId: b, qtyMilli: 25_500 },
    ]);
    expect(parsed.defaultRatePaise).toBe(650);
    expect(parsed.lowStockThreshold).toBe(5_000);
  });

  it('accepts a single row and drops a blank trailing row', () => {
    const parsed = CreateProductSchema.parse(
      foldRecipe({ ...base, recipe_materialId: [a, ''], recipe_qty: ['10', ''] }),
    );
    expect(parsed.recipe).toHaveLength(1);
    expect(
      CreateProductSchema.parse(foldRecipe({ ...base, recipe_materialId: a, recipe_qty: '1' }))
        .recipe,
    ).toHaveLength(1);
  });

  it('allows no recipe at all', () => {
    expect(CreateProductSchema.parse(foldRecipe(base)).recipe).toEqual([]);
  });

  it('refuses the same material twice', () => {
    const result = CreateProductSchema.safeParse(
      foldRecipe({ ...base, recipe_materialId: [a, a], recipe_qty: ['1', '2'] }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('duplicateMaterial');
  });

  it('refuses a zero quantity and a zero batch size', () => {
    expect(
      CreateProductSchema.safeParse(foldRecipe({ ...base, recipe_materialId: a, recipe_qty: '0' }))
        .success,
    ).toBe(false);
    expect(
      CreateProductSchema.safeParse(foldRecipe({ ...base, recipeBatchSize: '0' })).success,
    ).toBe(false);
  });

  it('refuses a stock count smuggled into the form', () => {
    expect(CreateProductSchema.safeParse(foldRecipe({ ...base, stockGood: '1000' })).success).toBe(
      false,
    );
  });
});

describe('AdjustStockSchema', () => {
  const adjust = { productId: a, reason: 'Broken in yard', date: '2026-10-01' };
  it('needs a positive count to add or remove', () => {
    expect(AdjustStockSchema.safeParse({ ...adjust, mode: 'remove', qty: '0' }).success).toBe(
      false,
    );
    expect(AdjustStockSchema.safeParse({ ...adjust, mode: 'remove', qty: '40' }).success).toBe(
      true,
    );
    expect(AdjustStockSchema.safeParse({ ...adjust, mode: 'set', qty: '0' }).success).toBe(true);
  });
});

describe('brick type names in two scripts', () => {
  it('fills English from a Hindi-only name', () => {
    const parsed = CreateProductSchema.parse(foldRecipe({ ...base, name: '', nameHi: 'ईंट' }));
    expect(parsed.name).toBe('Brick');
    expect(parsed.nameHi).toBe('ईंट');
  });

  it('rejects Hindi in the English box', () => {
    const result = CreateProductSchema.safeParse(foldRecipe({ ...base, name: 'ईंट' }));
    expect(result.error?.issues[0]).toMatchObject({ path: ['name'], message: 'mustBeEnglish' });
  });
});
