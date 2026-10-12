import { describe, expect, it } from 'vitest';
import { brokenShare, bucketLabel, bucketRange, parseGroup, prefixRegex } from './grouping';

describe('parseGroup', () => {
  it('accepts only the groupings the table offers', () => {
    expect(parseGroup({ group: 'week' }, ['day', 'week'] as const)).toBe('week');
    expect(parseGroup({ group: 'customer' }, ['day', 'week'] as const)).toBeNull();
    expect(parseGroup({}, ['day'] as const)).toBeNull();
  });
});

describe('bucketRange', () => {
  it('covers a single day, a Monday-start week and a whole month', () => {
    expect(bucketRange('2026-10-12', 'day')).toEqual({ from: '2026-10-12', to: '2026-10-12' });
    expect(bucketRange('2026-10-12', 'week')).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(bucketRange('2026-02-01', 'month')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(bucketRange('2028-02-01', 'month').to).toBe('2028-02-29');
  });
});

describe('bucketLabel', () => {
  it('names each bucket the way people say it', () => {
    expect(bucketLabel('2026-10-01', 'month', 'en')).toBe('October 2026');
    expect(bucketLabel('2026-10-12', 'week', 'en')).toBe('12 Oct – 18 Oct');
    expect(bucketLabel('2026-10-12', 'day', 'en')).toBe('12 Oct 2026');
  });
});

describe('prefixRegex', () => {
  it('anchors and escapes what was typed', () => {
    expect(prefixRegex('Ram (A)')).toEqual({ $regex: '^Ram \\(A\\)', $options: 'i' });
  });
});

describe('brokenShare', () => {
  it('is the broken fraction of all bricks, or null when none were made', () => {
    expect(brokenShare(95, 5)).toBeCloseTo(0.05);
    expect(brokenShare(0, 0)).toBeNull();
  });
});
