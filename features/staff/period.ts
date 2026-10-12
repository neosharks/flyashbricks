import { addDays, DAY_KEY_PATTERN, startOfMonthKey, todayKey } from '@/lib/dates';

export const PERIOD_PRESETS = ['month', 'lastMonth', 'custom'] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export type Period = { preset: PeriodPreset; from: string; to: string };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The pay period in the URL (`?period=lastMonth`, or `?period=custom&from=&to=`).
 * Anything malformed falls back to this month; a custom range never runs past
 * today and never backwards.
 */
export function parsePeriod(
  searchParams: SearchParams,
  timeZone: string,
  now = new Date(),
): Period {
  const today = todayKey(timeZone, now);
  const monthStart = startOfMonthKey(today);
  const preset =
    PERIOD_PRESETS.find((candidate) => candidate === first(searchParams.period)) ?? 'month';

  if (preset === 'lastMonth') {
    const lastMonthEnd = addDays(monthStart, -1);
    return { preset, from: startOfMonthKey(lastMonthEnd), to: lastMonthEnd };
  }

  if (preset === 'custom') {
    const from = first(searchParams.from);
    const to = first(searchParams.to);
    if (from && to && DAY_KEY_PATTERN.test(from) && DAY_KEY_PATTERN.test(to) && from <= to) {
      return { preset, from, to: to > today ? today : to };
    }
  }

  return { preset: 'month', from: monthStart, to: today };
}

/** `YYYY-MM` of a day key. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}
