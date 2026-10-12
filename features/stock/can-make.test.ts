import { describe, expect, it } from 'vitest';
import { canMake, limitingMaterial } from './can-make';

// Per 100 bricks: 150 kg fly ash, 75 kg sand, 25 kg cement.
const recipe = [
  { materialId: 'ash', qtyMilli: 150_000 },
  { materialId: 'sand', qtyMilli: 75_000 },
  { materialId: 'cement', qtyMilli: 25_000 },
];

describe('canMake', () => {
  it('is decided by the scarcest ingredient', () => {
    const balances = new Map([
      ['ash', 15_000_000],
      ['sand', 7_500_000],
      ['cement', 500_000],
    ]);
    expect(canMake(recipe, 100, balances)).toBe(2_000);
    expect(limitingMaterial(recipe, 100, balances)).toBe('cement');
  });

  it('is zero when any ingredient is missing', () => {
    expect(canMake(recipe, 100, new Map([['ash', 1_000_000]]))).toBe(0);
  });

  it('rounds down to whole bricks', () => {
    expect(canMake([{ materialId: 'a', qtyMilli: 3_000 }], 1, new Map([['a', 10_000]]))).toBe(3);
  });

  it('has no limit for a brick type without a recipe', () => {
    expect(canMake([], 100, new Map())).toBeNull();
  });
});
