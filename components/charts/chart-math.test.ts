import { describe, expect, it } from 'vitest';
import {
  changeRatio,
  clampTooltip,
  niceMax,
  share,
  summarize,
  ticks,
  windowed,
  windowsFrom,
} from './chart-math';

const data = [
  { values: { good: 100, broken: 5 } },
  { values: { good: 300, broken: 10 } },
  { values: { good: 0, broken: 0 } },
  { values: { good: 200, broken: 25 } },
];

describe('summarize', () => {
  it('totals, averages and finds the best point across the counted series', () => {
    const summary = summarize(data, ['good', 'broken']);
    expect(summary.pointTotals).toEqual([105, 310, 0, 225]);
    expect(summary.total).toBe(640);
    expect(summary.average).toBe(160);
    expect(summary.maxIndex).toBe(1);
    expect(summary.max).toBe(310);
  });

  it('leaves hidden series out of every figure', () => {
    const summary = summarize(data, ['broken']);
    expect(summary.total).toBe(40);
    expect(summary.maxIndex).toBe(3);
  });

  it('has no best point when everything is zero', () => {
    expect(summarize([{ values: { a: 0 } }], ['a']).maxIndex).toBeNull();
    expect(summarize([], ['a']).average).toBe(0);
  });

  it('ignores negative values rather than letting them cancel out', () => {
    expect(summarize([{ values: { a: -5 } }, { values: { a: 5 } }], ['a']).total).toBe(5);
  });
});

describe('changeRatio', () => {
  it('compares with the previous period', () => {
    expect(changeRatio(150, 100)).toBeCloseTo(0.5);
    expect(changeRatio(50, 100)).toBeCloseTo(-0.5);
  });

  it('says nothing when there is no previous period', () => {
    expect(changeRatio(10, 0)).toBeNull();
    expect(changeRatio(10, null)).toBeNull();
    expect(changeRatio(10, undefined)).toBeNull();
  });
});

describe('share', () => {
  it('is zero of an empty whole', () => {
    expect(share(5, 0)).toBe(0);
    expect(share(25, 100)).toBe(0.25);
  });
});

describe('niceMax and ticks', () => {
  it.each([
    [0, 1],
    [7, 10],
    [12, 20],
    [230, 250],
    [4_200, 5_000],
  ])('rounds %i up to %i', (value, expected) => {
    expect(niceMax(value)).toBe(expected);
  });

  it('spaces ticks evenly from zero', () => {
    expect(ticks(100, 4)).toEqual([0, 25, 50, 75, 100]);
    expect(ticks(10, 2)).toEqual([0, 5, 10]);
  });
});

describe('clampTooltip', () => {
  it('centres the tooltip when there is room', () => {
    expect(clampTooltip(200, 100, 400)).toBe(150);
  });

  it('keeps it inside both edges', () => {
    expect(clampTooltip(10, 100, 400)).toBe(0);
    expect(clampTooltip(395, 100, 400)).toBe(300);
  });

  it('pins it to the left when the container is narrower than the tooltip', () => {
    expect(clampTooltip(50, 200, 150)).toBe(0);
  });
});

describe('windowed', () => {
  const history = [1, 2, 3, 4, 5, 6];

  it('returns the latest window and the total of the one before it', () => {
    expect(windowed(history, 3, (value) => value)).toEqual({
      current: [4, 5, 6],
      previousTotal: 6,
    });
  });

  it('does not compare with a period that was mostly empty', () => {
    expect(windowed([0, 0, 9, 1, 1, 1], 3, (value) => value).previousTotal).toBe(9);
    expect(windowed([0, 0, 0, 0, 9, 1, 1, 1, 1, 1], 5, (value) => value).previousTotal).toBeNull();
  });

  it('has no previous total when history is too short', () => {
    expect(windowed(history, 4, (value) => value)).toEqual({
      current: [3, 4, 5, 6],
      previousTotal: null,
    });
  });
});

describe('windowsFrom', () => {
  it('builds every period the history covers, with a previous total where it reaches back', () => {
    const history = Array.from({ length: 20 }, () => 1);
    const windows = windowsFrom(history, [7, 14, 30], (value) => value);
    expect(
      windows.map((window) => [window.length, window.current.length, window.previousTotal]),
    ).toEqual([
      [7, 7, 7],
      [14, 14, null],
    ]);
  });
});
