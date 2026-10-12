/**
 * Calendar days are the organisation's days, not the server's. A brick yard in
 * India closes its day at midnight IST whatever timezone the server runs in, so
 * every "today", "this week" and daily chart goes through these helpers.
 */
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

const DAY_MS = 86_400_000;

/** Offset of `timeZone` from UTC at `date`, in milliseconds. */
function offsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - (date.getTime() - date.getMilliseconds());
}

/** `YYYY-MM-DD` of `date` in `timeZone`. */
export function dayKey(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** The instant a `YYYY-MM-DD` day starts in `timeZone`. */
export function startOfDay(key: string, timeZone = DEFAULT_TIMEZONE): Date {
  const [year, month, day] = key.split('-').map(Number);
  const utcMidnight = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  // Two passes settle the offset even on a day the zone changes its clock.
  const first = utcMidnight - offsetMs(new Date(utcMidnight), timeZone);
  return new Date(utcMidnight - offsetMs(new Date(first), timeZone));
}

export function addDays(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const shifted = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return shifted.toISOString().slice(0, 10);
}

export function todayKey(timeZone = DEFAULT_TIMEZONE, now = new Date()): string {
  return dayKey(now, timeZone);
}

/** Monday of the week containing `key`. */
export function startOfWeekKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const weekday = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
  return addDays(key, -((weekday + 6) % 7));
}

export function startOfMonthKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

/** Whole days from `from` to `to`, never negative. */
export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

/** Inclusive list of day keys, oldest first. */
export function dayRange(fromKey: string, toKey: string): string[] {
  const days: string[] = [];
  for (let key = fromKey; key <= toKey && days.length < 400; key = addDays(key, 1)) days.push(key);
  return days;
}

export const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
