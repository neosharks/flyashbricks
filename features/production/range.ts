import { addDays, DAY_KEY_PATTERN, startOfMonthKey } from '@/lib/dates';

export const RANGE_PRESETS = ['today', '7d', '30d', 'month', 'all', 'custom'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export type DayRange = {
  preset: RangePreset;
  /** Inclusive day keys; null means unbounded on that side. */
  from: string | null;
  to: string | null;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads `?range=` (a preset) or `?from=&to=` (custom day keys) from the URL.
 * Anything malformed falls back to the default preset; a reversed custom range
 * is swapped rather than producing an empty page.
 */
export function parseDayRange(
  query: SearchParams,
  today: string,
  fallback: Exclude<RangePreset, 'custom'> = '30d',
): DayRange {
  const raw = first(query.range);
  const preset = RANGE_PRESETS.find((candidate) => candidate === raw) ?? fallback;

  if (preset === 'custom') {
    return customRange(query, today, fallback);
  }

  return presetRange(preset, today);
}

function customRange(
  query: SearchParams,
  today: string,
  fallback: Exclude<RangePreset, 'custom'>,
): DayRange {
  const from = first(query.from);
  const to = first(query.to);
  const validFrom = from && DAY_KEY_PATTERN.test(from) ? from : null;
  const validTo = to && DAY_KEY_PATTERN.test(to) ? to : null;
  if (!validFrom && !validTo) return presetRange(fallback, today);
  if (validFrom && validTo && validFrom > validTo) {
    return { preset: 'custom', from: validTo, to: validFrom };
  }
  return { preset: 'custom', from: validFrom, to: validTo };
}

export function presetRange(preset: Exclude<RangePreset, 'custom'>, today: string): DayRange {
  switch (preset) {
    case 'today':
      return { preset, from: today, to: today };
    case '7d':
      return { preset, from: addDays(today, -6), to: today };
    case '30d':
      return { preset, from: addDays(today, -29), to: today };
    case 'month':
      return { preset, from: startOfMonthKey(today), to: today };
    case 'all':
      return { preset, from: null, to: null };
  }
}
