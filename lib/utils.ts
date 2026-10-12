import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { intlLocale } from './money';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string, locale = 'en', timeZone = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'medium', timeZone }).format(
    new Date(iso),
  );
}

export function formatDateTime(iso: string, locale = 'en', timeZone = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso));
}

export function formatNumber(value: number, locale = 'en'): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

export function formatPercent(fraction: number, locale = 'en'): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(fraction);
}

/** Escapes a string for use inside a RegExp built from user input. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Lowercased words and phone digits a record can be found by. Stored on the
 * document and matched with an anchored prefix, so search uses an index rather
 * than scanning with an unanchored, case-insensitive regex.
 */
export function searchTerms(...values: (string | null | undefined)[]): string[] {
  const terms = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const lower = value.normalize('NFKC').toLowerCase().trim();
    if (!lower) continue;
    terms.add(lower);
    for (const word of lower.split(/[\s,./()-]+/)) if (word) terms.add(word);
  }
  return [...terms].slice(0, 40);
}

/** "5 minutes ago", "3 days ago" — falls back to the date beyond a week. */
export function timeAgo(iso: string, locale = 'en', now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const format = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });
  const abs = Math.abs(seconds);
  if (abs < 60) return format.format(seconds, 'second');
  if (abs < 3600) return format.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return format.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86_400) return format.format(Math.round(seconds / 86_400), 'day');
  return formatDate(iso, locale);
}
