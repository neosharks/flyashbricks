import { describe, expect, it } from 'vitest';
import { MAX_AMOUNT_PAISE } from '@/lib/money';
import {
  ageingBucket,
  averageRate,
  computeSaleTotals,
  paymentStatus,
  priceBand,
  rateDifference,
  usualRate,
} from './totals';

describe('computeSaleTotals', () => {
  it('adds lines, delivery and discount in integer paise', () => {
    const result = computeSaleTotals({
      lines: [
        { qty: 1000, ratePaise: 650 },
        { qty: 250, ratePaise: 725 },
      ],
      deliveryPaise: 150_000,
      discountPaise: 6_250,
    });
    expect(result).toEqual({
      ok: true,
      totals: {
        bricks: 1250,
        subtotalPaise: 831_250,
        totalPaise: 975_000,
        lineAmounts: [650_000, 181_250],
      },
    });
  });

  it('refuses a discount larger than the bill', () => {
    expect(
      computeSaleTotals({
        lines: [{ qty: 1, ratePaise: 100 }],
        deliveryPaise: 0,
        discountPaise: 101,
      }),
    ).toEqual({ ok: false, error: 'discountTooLarge' });
  });

  it('allows a discount that makes the bill free', () => {
    const result = computeSaleTotals({
      lines: [{ qty: 10, ratePaise: 100 }],
      deliveryPaise: 0,
      discountPaise: 1000,
    });
    expect(result.ok && result.totals.totalPaise).toBe(0);
  });

  it('refuses totals beyond the money ceiling', () => {
    expect(
      computeSaleTotals({
        lines: [{ qty: 10_000_000, ratePaise: MAX_AMOUNT_PAISE }],
        deliveryPaise: 0,
        discountPaise: 0,
      }),
    ).toEqual({ ok: false, error: 'tooBig' });
  });
});

describe('paymentStatus', () => {
  it.each([
    [1000, 0, 'unpaid'],
    [1000, 1, 'partial'],
    [1000, 999, 'partial'],
    [1000, 1000, 'paid'],
    [0, 0, 'paid'],
  ] as const)('total %i paid %i is %s', (total, paid, expected) => {
    expect(paymentStatus(total, paid)).toBe(expected);
  });
});

describe('ageingBucket', () => {
  it.each([
    [0, 'd0_7'],
    [7, 'd0_7'],
    [8, 'd8_30'],
    [30, 'd8_30'],
    [31, 'd31_60'],
    [60, 'd31_60'],
    [61, 'd60'],
  ] as const)('%i days is %s', (days, bucket) => {
    expect(ageingBucket(days)).toBe(bucket);
  });
});

describe('averageRate', () => {
  it('is the goods value per brick, rounded to the paisa', () => {
    expect(averageRate(1_300_000, 2_000)).toBe(650);
    expect(averageRate(1_000, 3)).toBe(333);
    expect(averageRate(2_000, 3)).toBe(667);
  });

  it('is zero for a bill with no bricks', () => {
    expect(averageRate(5_000, 0)).toBe(0);
  });
});

describe('usualRate', () => {
  it('weights each line by how many bricks it has', () => {
    expect(
      usualRate([
        { qty: 3_000, defaultRatePaise: 650 },
        { qty: 1_000, defaultRatePaise: 850 },
      ]),
    ).toBe(700);
  });
});

describe('rateDifference', () => {
  it('is negative below the usual price and positive above it', () => {
    expect(rateDifference(600, 650)).toBe(-50);
    expect(rateDifference(700, 650)).toBe(50);
  });
});

describe('priceBand', () => {
  it.each([
    [600, 600],
    [624, 600],
    [625, 625],
    [649, 625],
    [0, 0],
    [-10, 0],
  ])('puts %i paise in the band starting at %i', (rate, band) => {
    expect(priceBand(rate)).toBe(band);
  });
});
