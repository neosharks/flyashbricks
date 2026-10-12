/**
 * Pure arithmetic behind the charts: summaries, comparisons, axis ticks and
 * tooltip placement. Kept out of the components so it can be tested on its own.
 */

export type ValuePoint = { values: Record<string, number> };

export type ChartSummary = {
  /** Sum of the counted series for each point, in order. */
  pointTotals: number[];
  total: number;
  average: number;
  /** Index of the largest point; null when every point is zero. */
  maxIndex: number | null;
  max: number;
};

/** Totals over only the `keys` series — a hidden series is left out everywhere. */
export function summarize(data: ValuePoint[], keys: string[]): ChartSummary {
  const pointTotals = data.map((point) =>
    keys.reduce((sum, key) => sum + Math.max(0, point.values[key] ?? 0), 0),
  );
  const total = pointTotals.reduce((sum, value) => sum + value, 0);
  let maxIndex: number | null = null;
  let max = 0;
  pointTotals.forEach((value, index) => {
    if (value > max) {
      max = value;
      maxIndex = index;
    }
  });
  return {
    pointTotals,
    total,
    average: data.length > 0 ? total / data.length : 0,
    maxIndex,
    max,
  };
}

/**
 * Fractional change from `previous` to `current` (0.25 = 25% more). Null when
 * there is nothing before to compare with — "up ∞%" helps nobody.
 */
export function changeRatio(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous <= 0) return null;
  return (current - previous) / previous;
}

/** Share of `part` in `whole`, 0 when the whole is empty. */
export function share(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

/** Rounds up to 1, 2, 2.5 or 5 × a power of ten, so axis labels are clean numbers. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** `intervals + 1` evenly spaced tick values from 0 to `max`. */
export function ticks(max: number, intervals: number): number[] {
  const count = Math.max(1, Math.round(intervals));
  return Array.from({ length: count + 1 }, (_, index) => (max * index) / count);
}

/**
 * Left offset for a tooltip of `width` centred on `center`, kept inside a
 * container of `containerWidth` — a tooltip over the first or last bar must
 * not hang off the edge of a phone screen.
 */
export function clampTooltip(center: number, width: number, containerWidth: number): number {
  if (containerWidth <= width) return 0;
  return Math.min(Math.max(center - width / 2, 0), containerWidth - width);
}

/**
 * The last `length` points of `history` and, when the history reaches far
 * enough back, the total of the equal window just before them.
 *
 * The earlier window must have activity on at least a third of its points:
 * a yard that started recording last month would otherwise "grow 2,000%"
 * against a month of empty days before it.
 */
export function windowed<T>(
  history: T[],
  length: number,
  totalOf: (point: T) => number,
): { current: T[]; previousTotal: number | null } {
  const current = history.slice(-length);
  if (history.length < length * 2) return { current, previousTotal: null };
  const previous = history.slice(-length * 2, -length);
  const active = previous.filter((point) => totalOf(point) > 0).length;
  if (active < previous.length / 3) return { current, previousTotal: null };
  return { current, previousTotal: previous.reduce((sum, point) => sum + totalOf(point), 0) };
}

/** One `windowed` slice per period length the history is long enough to show. */
export function windowsFrom<T>(
  history: T[],
  lengths: number[],
  totalOf: (point: T) => number,
): { length: number; current: T[]; previousTotal: number | null }[] {
  return lengths
    .filter((length) => length <= history.length)
    .map((length) => ({ length, ...windowed(history, length, totalOf) }));
}
