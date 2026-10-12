import { describe, expect, it } from 'vitest';
import { parsePeriod } from './period';

const NOW = new Date('2026-10-12T06:00:00Z');

describe('parsePeriod', () => {
  it('defaults to this month up to today', () => {
    expect(parsePeriod({}, 'Asia/Kolkata', NOW)).toEqual({
      preset: 'month',
      from: '2026-10-01',
      to: '2026-10-12',
    });
  });

  it('covers the whole of last month', () => {
    expect(parsePeriod({ period: 'lastMonth' }, 'Asia/Kolkata', NOW)).toEqual({
      preset: 'lastMonth',
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('accepts a custom range, clipped to today', () => {
    expect(
      parsePeriod({ period: 'custom', from: '2026-09-15', to: '2026-12-01' }, 'Asia/Kolkata', NOW),
    ).toEqual({
      preset: 'custom',
      from: '2026-09-15',
      to: '2026-10-12',
    });
  });

  it('falls back to this month for a backwards or malformed range', () => {
    expect(
      parsePeriod({ period: 'custom', from: '2026-10-10', to: '2026-10-01' }, 'Asia/Kolkata', NOW)
        .preset,
    ).toBe('month');
    expect(
      parsePeriod({ period: 'custom', from: 'yesterday', to: 'today' }, 'Asia/Kolkata', NOW).preset,
    ).toBe('month');
  });
});
