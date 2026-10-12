import { describe, expect, it } from 'vitest';
import { defectRate, plannedConsumption } from './consumption';

const recipe = [
  { materialId: 'ash', qtyMilli: 150_000 },
  { materialId: 'cement', qtyMilli: 25_000 },
];

describe('plannedConsumption', () => {
  it('scales the recipe to every brick pressed', () => {
    const lines = plannedConsumption(
      recipe,
      100,
      1_000,
      new Map([
        ['ash', 5_000_000],
        ['cement', 100_000],
      ]),
    );
    expect(lines).toEqual([
      { materialId: 'ash', needMilli: 1_500_000, availableMilli: 5_000_000, short: false },
      { materialId: 'cement', needMilli: 250_000, availableMilli: 100_000, short: true },
    ]);
  });

  it('rounds partial batches up so consumption is never under-counted', () => {
    const [line] = plannedConsumption([{ materialId: 'a', qtyMilli: 1_000 }], 3, 1, new Map());
    expect(line?.needMilli).toBe(334);
  });

  it('is empty when nothing was made', () => {
    expect(plannedConsumption(recipe, 100, 0, new Map())).toEqual([]);
  });
});

describe('defectRate', () => {
  it('is the defective share of everything pressed', () => {
    expect(defectRate(950, 50)).toBe(0.05);
    expect(defectRate(0, 0)).toBeNull();
  });
});
