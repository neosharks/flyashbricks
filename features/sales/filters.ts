import { z } from 'zod';
import { addDays, DAY_KEY_PATTERN, startOfMonthKey, startOfWeekKey, todayKey } from '@/lib/dates';

/**
 * The sales list's filters, parsed once from the URL and shared by the page,
 * its summary tiles and the CSV export, so what you download is exactly what
 * you are looking at.
 */
export const DATE_PRESETS = ['today', 'week', 'month', 'lastMonth', 'last30', 'custom'] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const STATUS_FILTERS = ['unpaid', 'partial', 'paid', 'voided', 'due'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export type SalesFilters = {
  range: DatePreset | null;
  /** Inclusive day keys; null for an open end. */
  from: string | null;
  to: string | null;
  status: StatusFilter | null;
  customerId: string | null;
  /** Only bills containing this brick type. */
  productId: string | null;
  /** Lower edge, in paise, of a price-per-brick band (see `priceBand`). */
  rateBand: number | null;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const dayKey = z.string().regex(DAY_KEY_PATTERN);

/** Resolves a preset into concrete day keys in the organisation's timezone. */
export function resolveRange(
  range: DatePreset | null,
  custom: { from: string | null; to: string | null },
  timeZone: string,
  now = new Date(),
): { from: string | null; to: string | null } {
  const today = todayKey(timeZone, now);
  switch (range) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: startOfWeekKey(today), to: today };
    case 'month':
      return { from: startOfMonthKey(today), to: today };
    case 'lastMonth': {
      const thisMonth = startOfMonthKey(today);
      const lastDay = addDays(thisMonth, -1);
      return { from: startOfMonthKey(lastDay), to: lastDay };
    }
    case 'last30':
      return { from: addDays(today, -29), to: today };
    case 'custom': {
      const { from, to } = custom;
      // A reversed range is read the way the person meant it.
      return from && to && from > to ? { from: to, to: from } : { from, to };
    }
    case null:
      return { from: null, to: null };
  }
}

export function parseSalesFilters(
  searchParams: SearchParams,
  timeZone: string,
  now = new Date(),
): SalesFilters {
  const rawRange = first(searchParams.range);
  const range = DATE_PRESETS.find((preset) => preset === rawRange) ?? null;
  const parseDay = (value: string | undefined) =>
    dayKey.safeParse(value).success ? (value ?? null) : null;
  const rawStatus = first(searchParams.status);
  const rawCustomer = first(searchParams.customer);
  const rawProduct = first(searchParams.product);
  const rawRate = first(searchParams.rate);

  const { from, to } = resolveRange(
    range,
    { from: parseDay(first(searchParams.from)), to: parseDay(first(searchParams.to)) },
    timeZone,
    now,
  );

  return {
    range,
    from,
    to,
    status: STATUS_FILTERS.find((status) => status === rawStatus) ?? null,
    customerId: rawCustomer && /^[a-f\d]{24}$/i.test(rawCustomer) ? rawCustomer : null,
    productId: rawProduct && /^[a-f\d]{24}$/i.test(rawProduct) ? rawProduct : null,
    rateBand: rawRate && /^\d{1,7}$/.test(rawRate) ? Number(rawRate) : null,
  };
}
