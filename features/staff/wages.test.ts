import { describe, expect, it } from 'vitest';
import {
  addCounts,
  balanceDue,
  daysInMonth,
  EMPTY_COUNTS,
  EMPTY_PAYMENTS,
  monthEarnings,
  overtimePay,
  type WageTerms,
} from './wages';

const counts = (overrides: Partial<typeof EMPTY_COUNTS>) => ({ ...EMPTY_COUNTS, ...overrides });

describe('monthEarnings', () => {
  const daily: WageTerms = { wageType: 'daily', wageRatePaise: 50_000, overtimeRatePaise: null };
  const monthly: WageTerms = {
    wageType: 'monthly',
    wageRatePaise: 1_500_000,
    overtimeRatePaise: null,
  };
  const piece: WageTerms = {
    wageType: 'per_thousand_bricks',
    wageRatePaise: 60_000,
    overtimeRatePaise: null,
  };

  it('pays daily workers per day present and half for a half day', () => {
    expect(monthEarnings(daily, counts({ present: 20, half_day: 3, absent: 7 }), 30)).toBe(
      1_075_000,
    );
  });

  it('pays the full monthly salary for a month without absences', () => {
    expect(monthEarnings(monthly, counts({ present: 26, leave: 1, holiday: 3 }), 30)).toBe(
      1_500_000,
    );
  });

  it('pays a monthly salary pro rata, leave and holidays included', () => {
    // 20 present + 2 leave + 4 holidays + 2 half days = 27 paid days of 30.
    expect(
      monthEarnings(
        monthly,
        counts({ present: 20, leave: 2, holiday: 4, half_day: 2, absent: 2 }),
        30,
      ),
    ).toBe(1_350_000);
  });

  it('pays piece-rate workers for bricks, not days, rounding to the paisa once', () => {
    expect(monthEarnings(piece, counts({ present: 3, bricks: 12_345 }), 30)).toBe(740_700);
  });

  it('adds overtime by the minute for any wage type', () => {
    const withOvertime = { ...daily, overtimeRatePaise: 6_000 };
    expect(overtimePay(withOvertime, 90)).toBe(9_000);
    expect(monthEarnings(withOvertime, counts({ present: 1, overtimeMinutes: 90 }), 30)).toBe(
      59_000,
    );
    expect(overtimePay(daily, 90)).toBe(0);
  });

  it('never produces a fraction of a paisa', () => {
    const odd: WageTerms = {
      wageType: 'monthly',
      wageRatePaise: 1_000_001,
      overtimeRatePaise: 3_333,
    };
    const value = monthEarnings(odd, counts({ present: 17, half_day: 1, overtimeMinutes: 7 }), 31);
    expect(Number.isInteger(value)).toBe(true);
  });
});

describe('balanceDue', () => {
  it('is earnings and bonuses less wages, advances and deductions', () => {
    expect(
      balanceDue(1_000_000, { wage: 600_000, advance: 100_000, bonus: 50_000, deduction: 20_000 }),
    ).toBe(330_000);
  });

  it('goes negative when an advance is ahead of earnings', () => {
    expect(balanceDue(0, { ...EMPTY_PAYMENTS, advance: 200_000 })).toBe(-200_000);
  });
});

describe('helpers', () => {
  it('knows month lengths, February included', () => {
    expect(daysInMonth('2026-10')).toBe(31);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2027-02')).toBe(28);
  });

  it('adds counts field by field', () => {
    expect(
      addCounts(counts({ present: 2, bricks: 5 }), counts({ present: 1, overtimeMinutes: 30 })),
    ).toEqual(counts({ present: 3, bricks: 5, overtimeMinutes: 30 }));
  });
});
