import type { AttendanceStatus, StaffPaymentType, WageType } from '@/models/constants';

/** Attendance for one worker over a stretch of days, by status. */
export type AttendanceCounts = Record<AttendanceStatus, number> & {
  overtimeMinutes: number;
  bricks: number;
};

export const EMPTY_COUNTS: AttendanceCounts = {
  present: 0,
  half_day: 0,
  absent: 0,
  leave: 0,
  holiday: 0,
  overtimeMinutes: 0,
  bricks: 0,
};

export type WageTerms = {
  wageType: WageType;
  wageRatePaise: number;
  overtimeRatePaise: number | null;
};

export function addCounts(a: AttendanceCounts, b: AttendanceCounts): AttendanceCounts {
  return {
    present: a.present + b.present,
    half_day: a.half_day + b.half_day,
    absent: a.absent + b.absent,
    leave: a.leave + b.leave,
    holiday: a.holiday + b.holiday,
    overtimeMinutes: a.overtimeMinutes + b.overtimeMinutes,
    bricks: a.bricks + b.bricks,
  };
}

/** Overtime is paid per hour, pro rata by the minute, rounded to the nearest paisa. */
export function overtimePay(terms: WageTerms, minutes: number): number {
  if (!terms.overtimeRatePaise || minutes <= 0) return 0;
  return Math.round((terms.overtimeRatePaise * minutes) / 60);
}

/**
 * What a worker earned for attendance within ONE calendar month.
 *
 * - daily:   the day rate for each day present, half of it for a half day.
 * - monthly: the month's salary shared over the days of that month; days
 *            present, on leave and holidays are paid in full, half days in
 *            half, absences not at all. A full month with no absences pays
 *            exactly the salary.
 * - per 1,000 bricks: the rate for the bricks they made, whatever the days.
 *
 * Plus overtime for every type. All amounts are whole paise, each part
 * rounded to the nearest paisa once (never per day, so rounding cannot add up).
 */
export function monthEarnings(
  terms: WageTerms,
  counts: AttendanceCounts,
  daysInMonth: number,
): number {
  const rate = terms.wageRatePaise;
  let base: number;
  switch (terms.wageType) {
    case 'daily':
      base = Math.round((rate * (2 * counts.present + counts.half_day)) / 2);
      break;
    case 'monthly': {
      const paidHalves = 2 * (counts.present + counts.leave + counts.holiday) + counts.half_day;
      base = Math.round((rate * paidHalves) / (2 * daysInMonth));
      break;
    }
    case 'per_thousand_bricks':
      base = Math.round((rate * counts.bricks) / 1000);
      break;
  }
  return base + overtimePay(terms, counts.overtimeMinutes);
}

export type PaymentTotals = Record<StaffPaymentType, number>;

export const EMPTY_PAYMENTS: PaymentTotals = { wage: 0, advance: 0, bonus: 0, deduction: 0 };

/**
 * What is still owed to the worker: earned plus bonuses, less everything
 * already handed over (wages, advances) and anything taken back (deductions).
 * Negative means they have been paid ahead — usually an advance not yet earned.
 */
export function balanceDue(earnedPaise: number, payments: PaymentTotals): number {
  return earnedPaise + payments.bonus - payments.wage - payments.advance - payments.deduction;
}

/** Days in the month of a `YYYY-MM` key. */
export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, month ?? 1, 0)).getUTCDate();
}
