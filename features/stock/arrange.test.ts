import { describe, expect, it } from 'vitest';
import { arrangeProducts, parseCardSort } from './arrange';
import type { ProductRow } from './types';

const row = (name: string, stockGood: number, extra: Partial<ProductRow> = {}): ProductRow => ({
  id: name,
  name,
  nameEn: name,
  nameHi: null,
  size: null,
  defaultRatePaise: 0,
  recipeBatchSize: 1,
  recipe: [],
  stockGood,
  lowStockThreshold: 0,
  isActive: true,
  level: 'good',
  canMake: null,
  limitingMaterial: null,
  ...extra,
});

const rows = [
  row('Solid', 500),
  row('Hollow', 2_000, { canMake: 900 }),
  row('Old', 9_000, { isActive: false }),
];

describe('arrangeProducts', () => {
  it('sorts by stock but keeps inactive types last', () => {
    expect(arrangeProducts(rows, '', 'stockHigh').map((r) => r.name)).toEqual([
      'Hollow',
      'Solid',
      'Old',
    ]);
  });

  it('searches the name and size, ignoring case', () => {
    expect(
      arrangeProducts([...rows, row('Paver', 1, { size: '230 × 110' })], '230', 'name').map(
        (r) => r.name,
      ),
    ).toEqual(['Paver']);
    expect(arrangeProducts(rows, 'sol', 'name').map((r) => r.name)).toEqual(['Solid']);
  });

  it('puts types with no recipe at the end when ordering by what can be made', () => {
    expect(arrangeProducts(rows, '', 'canMake')[0]?.name).toBe('Hollow');
  });

  it('falls back to name order for an unknown sort', () => {
    expect(parseCardSort('price')).toBe('name');
  });
});
