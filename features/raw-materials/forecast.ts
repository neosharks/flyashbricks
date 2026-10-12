import type { Level } from '@/components/ui/meter';

/** Days of consumption history the runway forecast averages over. */
export const RUNWAY_WINDOW_DAYS = 14;

/**
 * Severity of a stock level against its low threshold: critical at or below
 * the threshold, warning within half as much again above it.
 */
export function stockLevel(quantity: number, threshold: number): Level {
  if (quantity <= threshold) return 'critical';
  if (quantity <= threshold * 1.5) return 'warning';
  return 'good';
}

/**
 * Average daily use from the net consumption over the window (consumption is
 * negative, reversals positive). Null when nothing was used — no basis for a
 * forecast, which is different from "lasts forever".
 */
export function averageDailyUse(netConsumptionMilli: number, windowDays = RUNWAY_WINDOW_DAYS) {
  const used = -netConsumptionMilli;
  if (used <= 0 || windowDays <= 0) return null;
  return used / windowDays;
}

/** Whole days the current balance lasts at the average rate; null without a rate. */
export function runwayDays(quantityMilli: number, dailyUseMilli: number | null): number | null {
  if (dailyUseMilli === null || dailyUseMilli <= 0) return null;
  return Math.max(0, Math.floor(quantityMilli / dailyUseMilli));
}

/** Gauge fill: against capacity when known, else against twice the threshold. */
export function fillRatio(quantity: number, threshold: number, capacity: number | null): number {
  const scale = capacity && capacity > 0 ? capacity : Math.max(threshold * 2, quantity, 1);
  return Math.min(1, Math.max(0, quantity / scale));
}

/** Paise per whole unit from a purchase total; what the next purchase is compared against. */
export function ratePerUnit(costPaise: number, qtyMilli: number): number | null {
  if (qtyMilli <= 0) return null;
  return Math.round((costPaise * 1000) / qtyMilli);
}
