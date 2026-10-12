import { addDays } from '@/lib/dates';
import { intlLocale } from '@/lib/money';
import { escapeRegex } from '@/lib/utils';

/**
 * "Group by" for the operations tables. Time buckets are the organisation's
 * calendar days, Monday-start weeks and months; the aggregation and the
 * "open this group" link use the same day keys, so a group's total always
 * equals the filtered list it opens.
 */
export const TIME_UNITS = ['day', 'week', 'month'] as const;
export type TimeUnit = (typeof TIME_UNITS)[number];

type SearchParams = Record<string, string | string[] | undefined>;

/** `?group=` restricted to what a table offers; anything else means no grouping. */
export function parseGroup<G extends string>(query: SearchParams, allowed: readonly G[]): G | null {
  const raw = Array.isArray(query.group) ? query.group[0] : query.group;
  return allowed.find((candidate) => candidate === raw) ?? null;
}

export function isTimeUnit(value: string | null): value is TimeUnit {
  return value === 'day' || value === 'week' || value === 'month';
}

/** A Mongo expression giving the bucket's first day as `YYYY-MM-DD` in `timezone`. */
export function timeBucketExpression(field: string, unit: TimeUnit, timezone: string) {
  return {
    $dateToString: {
      format: '%Y-%m-%d',
      timezone,
      date: { $dateTrunc: { date: `$${field}`, unit, timezone, startOfWeek: 'monday' } },
    },
  };
}

/** Inclusive first and last day of a bucket, for the link that opens it. */
export function bucketRange(key: string, unit: TimeUnit): { from: string; to: string } {
  if (unit === 'day') return { from: key, to: key };
  if (unit === 'week') return { from: key, to: addDays(key, 6) };
  const [year = 1970, month = 1] = key.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: key, to: `${key.slice(0, 8)}${String(last).padStart(2, '0')}` };
}

/** "12 Oct 2026", "12 Oct – 18 Oct", "October 2026". */
export function bucketLabel(key: string, unit: TimeUnit, locale: string): string {
  const date = (day: string) => new Date(`${day}T00:00:00Z`);
  const lang = intlLocale(locale);
  if (unit === 'month') {
    return new Intl.DateTimeFormat(lang, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date(key));
  }
  const short = new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    ...(unit === 'day' ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
  if (unit === 'day') return short.format(date(key));
  return `${short.format(date(key))} – ${short.format(date(addDays(key, 6)))}`;
}

/**
 * Case-insensitive prefix match for searches over names people type. Anchored,
 * escaped and length-capped, so it is neither a ReDoS vector nor a full scan
 * beyond what the surrounding org + date filter already bounds.
 */
export function prefixRegex(q: string): { $regex: string; $options: 'i' } {
  return { $regex: `^${escapeRegex(q.slice(0, 80))}`, $options: 'i' };
}

/** Bricks broken out of all bricks made; null when nothing was made. */
export function brokenShare(good: number, broken: number): number | null {
  const total = good + broken;
  return total > 0 ? broken / total : null;
}
