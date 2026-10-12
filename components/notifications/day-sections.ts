import { addDays, dayKey } from '@/lib/dates';

/**
 * Splits a feed into consecutive same-day runs, in the order given, so a page
 * sorted newest-first or oldest-first both read as "Today / Yesterday / 9 Oct".
 * A day split across two pages simply continues under the same heading.
 */
export function sectionsByDay<T extends { createdAt: string }>(
  items: T[],
  timezone: string,
): { day: string; items: T[] }[] {
  const sections: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const day = dayKey(new Date(item.createdAt), timezone);
    const last = sections.at(-1);
    if (last?.day === day) last.items.push(item);
    else sections.push({ day, items: [item] });
  }
  return sections;
}

/** "today" / "yesterday" relative to `today`, otherwise null (caller shows the date). */
export function relativeDay(day: string, today: string): 'today' | 'yesterday' | null {
  if (day === today) return 'today';
  if (day === addDays(today, -1)) return 'yesterday';
  return null;
}
