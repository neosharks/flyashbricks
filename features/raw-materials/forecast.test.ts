import { describe, expect, it } from 'vitest';
import { averageDailyUse, fillRatio, ratePerUnit, runwayDays, stockLevel } from './forecast';

describe('stockLevel', () => {
  it.each([
    [100, 100, 'critical'],
    [50, 100, 'critical'],
    [150, 100, 'warning'],
    [151, 100, 'good'],
    [0, 0, 'critical'],
  ] as const)('%d against threshold %d is %s', (quantity, threshold, expected) => {
    expect(stockLevel(quantity, threshold)).toBe(expected);
  });
});

describe('runway', () => {
  it('averages net consumption over the window', () => {
    expect(averageDailyUse(-14_000, 14)).toBe(1_000);
  });

  it('has no forecast when nothing was used or reversals outweigh use', () => {
    expect(averageDailyUse(0)).toBeNull();
    expect(averageDailyUse(500)).toBeNull();
    expect(runwayDays(10_000, null)).toBeNull();
  });

  it('counts whole days the balance lasts', () => {
    expect(runwayDays(10_500, 1_000)).toBe(10);
    expect(runwayDays(0, 1_000)).toBe(0);
  });
});

describe('fillRatio', () => {
  it('uses capacity when known', () => {
    expect(fillRatio(250, 100, 1_000)).toBe(0.25);
  });

  it('falls back to twice the threshold, never overflowing', () => {
    expect(fillRatio(100, 100, null)).toBe(0.5);
    expect(fillRatio(900, 100, null)).toBe(1);
    expect(fillRatio(0, 0, null)).toBe(0);
  });
});

describe('ratePerUnit', () => {
  it('turns a purchase total into paise per whole unit', () => {
    // 50 bags for ₹19,000 → ₹380 a bag.
    expect(ratePerUnit(1_900_000, 50_000)).toBe(38_000);
    expect(ratePerUnit(100, 0)).toBeNull();
  });
});
