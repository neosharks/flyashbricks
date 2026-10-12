import { intlLocale } from './money';

/**
 * Raw material quantities are integers in thousandths of the material's unit
 * ("milli-units"): 1250.5 kg is stored as 1_250_500. Integer arithmetic keeps
 * thousands of small consumption entries from drifting the way floats would.
 */
export const MILLI = 1000;

/** A trillion milli-units: a billion tonnes. Anything above is a typo. */
export const MAX_QUANTITY_MILLI = 1_000_000_000_000;

export const UNITS = ['kg', 'tonne', 'bag', 'litre'] as const;
export type Unit = (typeof UNITS)[number];

export function formatQuantity(milli: number, locale = 'en'): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 3 }).format(
    milli / MILLI,
  );
}

/** "1,250.5" → 1_250_500. Null for anything that is not a plain non-negative number. */
export function parseQuantity(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '');
  const match = /^(\d{1,12})(?:\.(\d{1,3}))?$/.exec(cleaned);
  if (!match) return null;
  return Number(match[1]) * MILLI + Number((match[2] ?? '').padEnd(3, '0'));
}

export function quantityToInput(milli: number): string {
  const whole = Math.trunc(milli / MILLI);
  const rest = Math.abs(milli % MILLI);
  if (rest === 0) return String(whole);
  return `${whole}.${String(rest).padStart(3, '0').replace(/0+$/, '')}`;
}

/**
 * Material needed for a number of bricks, given a recipe line of `perBatchMilli`
 * for every `batchSize` bricks. Rounded up: under-counting consumption would
 * overstate what is left in the yard.
 */
export function consumptionFor(bricks: number, perBatchMilli: number, batchSize: number): number {
  return Math.ceil((bricks * perBatchMilli) / batchSize);
}
