/**
 * Money is an integer count of paise everywhere it is stored or computed.
 * It is only ever typed and shown as rupees, at the edge.
 */
export const CURRENCY = 'INR';

/** Ten crore rupees: far above any single sale, low enough to catch a typo. */
export const MAX_AMOUNT_PAISE = 10_000_000_000;

export function formatMoney(paise: number, locale = 'en-IN'): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}

/** Short form for chart labels and tight tiles: ₹1.2L, ₹3.4Cr. */
export function formatMoneyCompact(paise: number, locale = 'en-IN'): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency: CURRENCY,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(paise / 100);
}

/**
 * Parses what a person types into a rupee field ("1,250.5") into paise.
 * Returns null for anything that is not a plain non-negative amount with at
 * most two decimal places. Never goes through floating point.
 */
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const rupees = Number(match[1]);
  const paise = Number((match[2] ?? '').padEnd(2, '0'));
  return rupees * 100 + paise;
}

/** Plain decimal string for an input's default value: 125050 → "1250.50". */
export function paiseToInput(paise: number): string {
  const rupees = Math.trunc(paise / 100);
  const rest = paise % 100;
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, '0')}`;
}

export function intlLocale(locale: string): string {
  return locale === 'hi' ? 'hi-IN' : 'en-IN';
}
