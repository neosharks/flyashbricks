import { MAX_AMOUNT_PAISE } from '@/lib/money';
import type { PaymentStatus } from '@/models/constants';

/**
 * All bill arithmetic, in integer paise. The server recomputes every total
 * from the lines with these functions; a total sent by the browser is never
 * trusted, only the quantities and rates it was built from.
 */
export type LineInput = { qty: number; ratePaise: number };

export type SaleTotals = {
  bricks: number;
  subtotalPaise: number;
  /** Bricks + delivery − discount: the taxable value; GST is added on top of it. */
  totalPaise: number;
  lineAmounts: number[];
};

export type TotalsError = 'discountTooLarge' | 'tooBig';

export function computeSaleTotals(input: {
  lines: LineInput[];
  deliveryPaise: number;
  discountPaise: number;
}): { ok: true; totals: SaleTotals } | { ok: false; error: TotalsError } {
  const lineAmounts = input.lines.map((line) => line.qty * line.ratePaise);
  const subtotalPaise = lineAmounts.reduce((sum, amount) => sum + amount, 0);
  const bricks = input.lines.reduce((sum, line) => sum + line.qty, 0);
  const gross = subtotalPaise + input.deliveryPaise;

  if (!Number.isSafeInteger(gross) || gross > MAX_AMOUNT_PAISE)
    return { ok: false, error: 'tooBig' };
  if (input.discountPaise > gross) return { ok: false, error: 'discountTooLarge' };

  return {
    ok: true,
    totals: { bricks, subtotalPaise, totalPaise: gross - input.discountPaise, lineAmounts },
  };
}

/** A bill of nothing (fully discounted) counts as settled. */
export function paymentStatus(totalPaise: number, paidPaise: number): PaymentStatus {
  if (paidPaise >= totalPaise) return 'paid';
  return paidPaise > 0 ? 'partial' : 'unpaid';
}

export const AGEING_BUCKETS = ['d0_7', 'd8_30', 'd31_60', 'd60'] as const;
export type AgeingBucket = (typeof AGEING_BUCKETS)[number];

/** Which ageing column an unpaid balance belongs in, by days since the sale. */
export function ageingBucket(daysPending: number): AgeingBucket {
  if (daysPending <= 7) return 'd0_7';
  if (daysPending <= 30) return 'd8_30';
  if (daysPending <= 60) return 'd31_60';
  return 'd60';
}

/**
 * Goods value per brick, rounded to the paisa: what the bricks actually sold
 * for, before delivery, discount and tax. A bill with no bricks has no rate.
 */
export function averageRate(subtotalPaise: number, bricks: number): number {
  return bricks > 0 ? Math.round(subtotalPaise / bricks) : 0;
}

/** Positive when charged above the usual price, negative below. */
export function rateDifference(ratePaise: number, defaultRatePaise: number): number {
  return ratePaise - defaultRatePaise;
}

/** Price bands for "group by price": 25 paise wide, labelled by their lower edge. */
export const PRICE_BAND_PAISE = 25;

export function priceBand(ratePaise: number, width = PRICE_BAND_PAISE): number {
  return Math.floor(Math.max(0, ratePaise) / width) * width;
}

/**
 * The usual price across a bill's lines, weighted by quantity: what the bill
 * would have cost per brick at every brick type's default rate.
 */
export function usualRate(lines: { qty: number; defaultRatePaise: number }[]): number {
  const bricks = lines.reduce((sum, line) => sum + line.qty, 0);
  const value = lines.reduce((sum, line) => sum + line.qty * line.defaultRatePaise, 0);
  return averageRate(value, bricks);
}
