'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Maximize2, TrendingDown, TrendingUp } from 'lucide-react';
import { FullscreenDialog } from '@/components/ui/fullscreen-dialog';
import { cn, formatPercent } from '@/lib/utils';
import {
  changeRatio,
  clampTooltip,
  niceMax,
  share,
  summarize,
  ticks,
  type ChartSummary,
} from './chart-math';

export type ColumnSeries = {
  key: string;
  label: string;
  /** A chart role from globals.css: `chart-1`, `chart-2`, `chart-3`. */
  color: 'chart-1' | 'chart-2' | 'chart-3';
};

export type ColumnDatum = {
  /** Axis label, already formatted: "12 Oct". */
  label: string;
  /** One value per series key. */
  values: Record<string, number>;
  /** Extra facts shown when this column is selected, already formatted. */
  details?: { label: string; value: string }[];
};

/** An alternative period the full-screen view can switch to. */
export type ChartRange = {
  key: string;
  label: string;
  data: ColumnDatum[];
  /** Total of the equal period before, for the "compared with before" figure. */
  previousTotal?: number | null;
};

export type ChartInsight = { label: string; value: string };

type ColumnChartProps = {
  title: string;
  data: ColumnDatum[];
  series: ColumnSeries[];
  /** Formats a value for the tooltip, the insights and the table. */
  format: (value: number) => string;
  /** Compact form for axis ticks and the label on the tallest column; defaults to `format`. */
  formatTick?: (value: number) => string;
  height?: number;
  /** Labels shown under the columns; every Nth is drawn so they never collide. */
  maxAxisLabels?: number;
  emptyLabel: string;
  /** What one column stands for; words the average, best and table headings. */
  unit?: 'day' | 'month';
  /** Total of the equal period before `data`; shows "compared with before". */
  previousTotal?: number | null | undefined;
  /** Whether a rise is good news (sales) or just a fact (material used). */
  higherIsBetter?: boolean;
  /** Other periods for the full-screen view, e.g. 7 / 14 / 30 days. */
  ranges?: ChartRange[];
  /** Which of `ranges` the inline `data` is; the full-screen view opens on it. */
  rangeKey?: string;
  /** Additional headline figures worked out from the shown data, e.g. a broken-brick rate. */
  extraInsights?: (data: ColumnDatum[], visibleKeys: string[]) => ChartInsight[];
};

const FILL: Record<ColumnSeries['color'], string> = {
  'chart-1': 'fill-chart-1',
  'chart-2': 'fill-chart-2',
  'chart-3': 'fill-chart-3',
};
const SWATCH: Record<ColumnSeries['color'], string> = {
  'chart-1': 'bg-chart-1',
  'chart-2': 'bg-chart-2',
  'chart-3': 'bg-chart-3',
};

/**
 * Columns over time, stacked when there is more than one series.
 *
 * Plain SVG rather than a charting library: a few rectangles do not justify
 * the bundle. Follows the chart rules: one baseline, columns capped at 24px
 * with a rounded data-end, a 2px surface gap between stacked segments,
 * recessive hairline grid, a legend for two or more series, labels in ink
 * rather than series colour, and the numbers repeated as a table.
 *
 * Built for people reading it on a phone: the headline figures are written
 * out above the plot, tapping a column pins its details (arrow keys do the
 * same from a keyboard), and the full-screen view adds other periods and
 * every number in a table.
 */
export function ColumnChart(props: ColumnChartProps) {
  const t = useTranslations('charts');
  const { title, data, series, emptyLabel, ranges } = props;
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [fullscreen, setFullscreen] = useState(false);

  const visible = series.filter((item) => !hidden.has(item.key));
  const hasData = data.some((datum) => series.some((item) => (datum.values[item.key] ?? 0) > 0));
  const anyRangeHasData = ranges?.some((range) =>
    range.data.some((datum) => series.some((item) => (datum.values[item.key] ?? 0) > 0)),
  );

  if (!hasData && !anyRangeHasData) {
    return (
      <div className="text-foreground-muted brick-pattern flex h-40 items-center justify-center rounded-md px-4 text-center text-sm">
        {emptyLabel}
      </div>
    );
  }

  const toggle = (key: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      // The last visible series stays: an empty chart answers nothing.
      else if (series.length - next.size > 1) next.add(key);
      return next;
    });

  return (
    <figure className="relative">
      {hasData ? (
        <>
          <Insights {...props} visible={visible} hiddenCount={hidden.size} compact />
          <Toolbar
            series={series}
            hidden={hidden}
            onToggle={toggle}
            onFullscreen={() => setFullscreen(true)}
            title={title}
          />
          <Plot {...props} visible={visible} tickIntervals={2} />
        </>
      ) : (
        <>
          <div className="mb-2 flex justify-end">
            <FullscreenButton title={title} onClick={() => setFullscreen(true)} />
          </div>
          <div className="text-foreground-muted brick-pattern flex h-40 items-center justify-center rounded-md px-4 text-center text-sm">
            {emptyLabel}
          </div>
        </>
      )}

      <FullscreenDialog
        open={fullscreen}
        onOpenChange={setFullscreen}
        title={title}
        closeLabel={t('close')}
      >
        {fullscreen && <FullscreenBody {...props} hidden={hidden} onToggle={toggle} />}
      </FullscreenDialog>

      <figcaption className="sr-only">
        <DataTable {...props} />
      </figcaption>
    </figure>
  );
}

function FullscreenButton({ title, onClick }: { title: string; onClick: () => void }) {
  const t = useTranslations('charts');
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('openFullScreen', { title })}
      title={t('fullScreen')}
      className="border-border text-foreground-muted hover:bg-surface-muted hover:text-foreground inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium"
    >
      <Maximize2 aria-hidden className="size-4" />
      <span className="hidden sm:inline">{t('fullScreen')}</span>
    </button>
  );
}

/** Legend toggles (two or more series) or the tap hint, and the full-screen button. */
function Toolbar({
  series,
  hidden,
  onToggle,
  onFullscreen,
  title,
}: {
  series: ColumnSeries[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
  onFullscreen?: () => void;
  title: string;
}) {
  const t = useTranslations('charts');
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      {series.length > 1 ? (
        <ul aria-label={t('series')} className="flex flex-wrap gap-1.5">
          {series.map((item) => {
            const on = !hidden.has(item.key);
            const last = on && series.length - hidden.size === 1;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={
                    on
                      ? t('hideSeries', { name: item.label })
                      : t('showSeries', { name: item.label })
                  }
                  disabled={last}
                  onClick={() => onToggle(item.key)}
                  className={cn(
                    'border-border inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors sm:min-h-9',
                    on
                      ? 'bg-surface text-foreground'
                      : 'text-foreground-subtle bg-transparent line-through',
                    last && 'cursor-default',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn('size-2.5 rounded-sm', SWATCH[item.color], !on && 'opacity-30')}
                  />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-foreground-subtle text-xs">{t('hint')}</p>
      )}
      {onFullscreen && <FullscreenButton title={title} onClick={onFullscreen} />}
    </div>
  );
}

/** Total, average, best column, change against before — written out, not left to the eye. */
function Insights({
  data,
  format,
  unit = 'day',
  previousTotal,
  higherIsBetter = true,
  extraInsights,
  visible,
  hiddenCount,
  compact = false,
}: ColumnChartProps & { visible: ColumnSeries[]; hiddenCount: number; compact?: boolean }) {
  const t = useTranslations('charts');
  const locale = useLocale();
  const keys = visible.map((item) => item.key);
  const summary = summarize(data, keys);
  // A hidden series is not in this total but is in the previous one.
  const change = hiddenCount === 0 ? changeRatio(summary.total, previousTotal) : null;
  const best = summary.maxIndex === null ? null : data[summary.maxIndex];
  const extras = extraInsights?.(data, keys) ?? [];

  const items: { label: string; value: string; sub?: React.ReactNode }[] = [
    { label: t('total'), value: format(summary.total) },
    { label: t(`average.${unit}`), value: format(Math.round(summary.average)) },
    ...(best ? [{ label: t(`best.${unit}`), value: format(summary.max), sub: best.label }] : []),
    ...extras.map((extra) => ({ label: extra.label, value: extra.value })),
  ];

  return (
    <div className={cn('mb-3', compact ? '' : 'mb-5')}>
      <dl
        className={cn(
          'grid gap-x-4 gap-y-2',
          compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 lg:grid-cols-4',
        )}
      >
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-foreground-muted truncate text-xs">{item.label}</dt>
            <dd className={cn('font-semibold tabular-nums', compact ? 'text-sm' : 'text-lg')}>
              {item.value}
              {item.sub && (
                <span className="text-foreground-muted ml-1 text-xs font-normal">· {item.sub}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {change !== null && (
        <ChangeLine
          change={change}
          count={data.length}
          unit={unit}
          higherIsBetter={higherIsBetter}
          locale={locale}
        />
      )}
    </div>
  );
}

function ChangeLine({
  change,
  count,
  unit,
  higherIsBetter,
  locale,
}: {
  change: number;
  count: number;
  unit: 'day' | 'month';
  higherIsBetter: boolean;
  locale: string;
}) {
  const t = useTranslations('charts');
  const period = t(`period.${unit}`, { count });
  const percent = formatPercent(Math.abs(change), locale);
  const flat = Math.abs(change) < 0.005;
  const up = change > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const tone =
    flat || !higherIsBetter ? 'text-foreground-muted' : up ? 'text-success' : 'text-danger';

  return (
    <p className={cn('mt-2 flex items-center gap-1.5 text-xs font-medium', tone)}>
      {!flat && <Icon aria-hidden className="size-3.5" />}
      <span className="text-foreground-muted font-normal">{t('change.label')}:</span>
      {flat
        ? t('change.same', { period })
        : up
          ? t('change.up', { percent, period })
          : t('change.down', { percent, period })}
    </p>
  );
}

const TOOLTIP_WIDTH = 208;

/**
 * Tracks an element's rendered width, so the chart is drawn at its real size
 * (text stays readable on a phone) and the tooltip can be kept on screen.
 */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Very old browsers (and test environments) lack ResizeObserver; measure once.
    if (typeof ResizeObserver === 'undefined') {
      setWidth(element.getBoundingClientRect().width);
      return;
    }
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function Plot({
  title,
  data,
  format,
  formatTick,
  height = 200,
  maxAxisLabels = 8,
  unit = 'day',
  visible,
  tickIntervals,
}: ColumnChartProps & { visible: ColumnSeries[]; tickIntervals: number }) {
  const t = useTranslations('charts');
  const locale = useLocale();
  const id = useId();
  const [containerRef, containerWidth] = useWidth<HTMLDivElement>();
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? selected;

  // A pinned column is released by tapping anywhere else on the page.
  useEffect(() => {
    if (selected === null) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setSelected(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [selected, containerRef]);

  const keys = visible.map((item) => item.key);
  const summary = summarize(data, keys);
  const max = niceMax(summary.max);
  const tick = formatTick ?? format;

  // Until the container is measured (server render), draw at a desktop width.
  const width = containerWidth > 0 ? containerWidth : 640;
  const padLeft = 44;
  const padTop = 18;
  const padBottom = 22;
  const plotHeight = height - padBottom - padTop;
  const band = data.length > 0 ? (width - padLeft) / data.length : 0;
  const barWidth = Math.min(24, Math.max(4, band * 0.6));
  // Roughly 48px per date label, so they never run into each other on a phone.
  const labelSlots = Math.max(1, Math.min(maxAxisLabels, Math.floor((width - padLeft) / 48)));
  const labelEvery = Math.max(1, Math.ceil(data.length / labelSlots));
  const yFor = (value: number) => padTop + plotHeight - (value / max) * plotHeight;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const last = data.length - 1;
    const moves: Record<string, (current: number | null) => number | null> = {
      ArrowRight: (current) => (current === null ? 0 : Math.min(current + 1, last)),
      ArrowLeft: (current) => (current === null ? last : Math.max(current - 1, 0)),
      Home: () => 0,
      End: () => last,
      Escape: () => null,
    };
    const move = moves[event.key];
    if (!move || data.length === 0) return;
    event.preventDefault();
    setHovered(null);
    setSelected(move);
  };

  const pinned = selected === null ? undefined : data[selected];
  const announcement = pinned
    ? t('selected', {
        label: pinned.label,
        details: visible
          .map((item) => `${item.label}: ${format(pinned.values[item.key] ?? 0)}`)
          .join(', '),
      })
    : '';

  const center =
    active === null ? 0 : ((padLeft + active * band + band / 2) / width) * containerWidth;
  const tooltipLeft = clampTooltip(center, TOOLTIP_WIDTH, containerWidth);

  return (
    // A slider over the columns: arrow keys walk the days, and the value text
    // tells a screen reader exactly what the pinned column says.
    <div
      ref={containerRef}
      role="slider"
      tabIndex={0}
      aria-label={`${title}. ${t('hint')}`}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, data.length - 1)}
      aria-valuenow={selected ?? 0}
      aria-valuetext={announcement === '' ? t('hint') : announcement}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className="relative rounded-md"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible select-none"
        role="img"
        aria-labelledby={`${id}-title`}
        onPointerLeave={() => setHovered(null)}
      >
        <title id={`${id}-title`}>{title}</title>

        {ticks(max, tickIntervals).map((value) => {
          const y = yFor(value);
          return (
            <g key={value}>
              <line
                x1={padLeft}
                x2={width}
                y1={y}
                y2={y}
                className={value === 0 ? 'stroke-chart-axis' : 'stroke-chart-grid'}
                strokeWidth={1}
              />
              <text
                x={padLeft - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-foreground-subtle text-[10px] tabular-nums"
              >
                {tick(value)}
              </text>
            </g>
          );
        })}

        {data.map((datum, index) => {
          const x = padLeft + index * band + (band - barWidth) / 2;
          let stackTop = padTop + plotHeight;
          const segments = visible
            .map((item) => ({ item, value: Math.max(0, datum.values[item.key] ?? 0) }))
            .filter((segment) => segment.value > 0);
          const dimmed = active !== null && active !== index;

          return (
            <g key={datum.label + String(index)}>
              {segments.map(({ item, value }, segmentIndex) => {
                const segmentHeight = (value / max) * plotHeight;
                const isTop = segmentIndex === segments.length - 1;
                // 2px surface gap between stacked segments.
                const gap = segmentIndex > 0 ? 2 : 0;
                const y = stackTop - segmentHeight;
                const h = Math.max(1, segmentHeight - gap);
                stackTop = y;
                const radius = isTop ? Math.min(4, h, barWidth / 2) : 0;
                return (
                  <path
                    key={item.key}
                    className={cn(FILL[item.color], 'transition-opacity')}
                    opacity={dimmed ? 0.4 : 1}
                    d={roundedTop(x, y, barWidth, h, radius)}
                  />
                );
              })}

              {/* The one direct label: the tallest column. */}
              {index === summary.maxIndex && (
                <text
                  x={x + barWidth / 2}
                  y={yFor(summary.max) - 5}
                  textAnchor="middle"
                  className="fill-foreground-muted text-[10px] font-medium tabular-nums"
                >
                  {tick(summary.max)}
                </text>
              )}

              {index % labelEvery === 0 && (
                <text
                  x={x + barWidth / 2}
                  y={height - 6}
                  textAnchor="middle"
                  className={cn(
                    'text-[10px]',
                    active === index ? 'fill-foreground font-medium' : 'fill-foreground-subtle',
                  )}
                >
                  {datum.label}
                </text>
              )}

              {/* Hit target: the whole band, taller and wider than the mark. */}
              <rect
                x={padLeft + index * band}
                y={0}
                width={band}
                height={height - padBottom}
                fill="transparent"
                className="cursor-pointer"
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') setHovered(index);
                }}
                onClick={() => {
                  setHovered(null);
                  setSelected((current) => (current === index ? null : index));
                }}
              />
            </g>
          );
        })}

        {/* Average line: dashed and quiet, so it reads as a reference, not data. */}
        {data.length > 1 && summary.average > 0 && (
          <g aria-hidden className="pointer-events-none">
            <line
              x1={padLeft}
              x2={width}
              y1={yFor(summary.average)}
              y2={yFor(summary.average)}
              className="stroke-foreground-muted"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.7}
            />
            <text
              x={width - 2}
              y={yFor(summary.average) - 4}
              textAnchor="end"
              className="fill-foreground-muted text-[10px] font-medium"
            >
              {t('avg')}
            </text>
          </g>
        )}
      </svg>

      {active !== null && data[active] && (
        <div
          className="border-border bg-surface-raised pointer-events-none absolute top-0 z-10 rounded-md border px-3 py-2 text-xs shadow-md"
          style={{ left: tooltipLeft, width: TOOLTIP_WIDTH }}
        >
          <PointDetails
            datum={data[active]}
            total={summary.pointTotals[active] ?? 0}
            summary={summary}
            visible={visible}
            format={format}
            unit={unit}
            locale={locale}
          />
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

/** The insight card for one column: values, shares, and how it compares with the average. */
function PointDetails({
  datum,
  total,
  summary,
  visible,
  format,
  unit,
  locale,
}: {
  datum: ColumnDatum;
  total: number;
  summary: ChartSummary;
  visible: ColumnSeries[];
  format: (value: number) => string;
  unit: 'day' | 'month';
  locale: string;
}) {
  const t = useTranslations('charts');
  const vsAverage = summary.average > 0 ? (total - summary.average) / summary.average : null;
  const percent = (fraction: number) => formatPercent(fraction, locale);

  return (
    <>
      <p className="text-foreground font-semibold">{datum.label}</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {visible.map((item) => {
          const value = Math.max(0, datum.values[item.key] ?? 0);
          return (
            <li key={item.key} className="flex items-center justify-between gap-3">
              <span className="text-foreground-muted flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn('size-2 shrink-0 rounded-sm', SWATCH[item.color])}
                />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="text-foreground text-right tabular-nums">
                {format(value)}
                {visible.length > 1 && total > 0 && (
                  <span className="text-foreground-muted ml-1">
                    ({percent(share(value, total))})
                  </span>
                )}
              </span>
            </li>
          );
        })}
        {visible.length > 1 && (
          <li className="border-border mt-0.5 flex justify-between gap-3 border-t pt-0.5 font-medium">
            <span>{t('pointTotal')}</span>
            <span className="tabular-nums">{format(total)}</span>
          </li>
        )}
        {datum.details?.map((detail) => (
          <li key={detail.label} className="flex justify-between gap-3">
            <span className="text-foreground-muted">{detail.label}</span>
            <span className="text-foreground tabular-nums">{detail.value}</span>
          </li>
        ))}
      </ul>
      {vsAverage !== null && (
        <p className="text-foreground-muted mt-1.5">
          {total === 0
            ? t('vsAverage.nothing')
            : Math.abs(vsAverage) < 0.005
              ? t('vsAverage.same')
              : vsAverage > 0
                ? t('vsAverage.above', { percent: percent(vsAverage) })
                : t('vsAverage.below', { percent: percent(-vsAverage) })}
          {visible.length === 1 && summary.total > 0 && (
            <>
              {' · '}
              {t('shareOfTotal', {
                percent: percent(share(total, summary.total)),
                unit: t(`unit.${unit}`),
              })}
            </>
          )}
        </p>
      )}
    </>
  );
}

function FullscreenBody(
  props: ColumnChartProps & { hidden: Set<string>; onToggle: (key: string) => void },
) {
  const t = useTranslations('charts');
  const { ranges, rangeKey, hidden, onToggle, series } = props;
  const [current, setCurrent] = useState(rangeKey ?? ranges?.[0]?.key ?? null);
  const range = ranges?.find((candidate) => candidate.key === current);
  const data = range?.data ?? props.data;
  const previousTotal = range ? (range.previousTotal ?? null) : props.previousTotal;
  const visible = series.filter((item) => !hidden.has(item.key));
  const view = { ...props, data, previousTotal };
  const long = data.length > 31;

  return (
    <div className="flex flex-col gap-5">
      {ranges && ranges.length > 1 && (
        <fieldset>
          <legend className="text-foreground-muted mb-1.5 text-xs font-medium">{t('range')}</legend>
          <div className="bg-surface-muted inline-flex flex-wrap rounded-lg p-1">
            {ranges.map((option) => (
              <label
                key={option.key}
                className={cn(
                  'flex min-h-10 cursor-pointer items-center rounded-md px-4 text-sm font-medium',
                  option.key === current
                    ? 'bg-surface text-foreground shadow-xs'
                    : 'text-foreground-muted hover:text-foreground',
                )}
              >
                <input
                  type="radio"
                  name="chart-range"
                  value={option.key}
                  checked={option.key === current}
                  onChange={() => setCurrent(option.key)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <section className="border-border bg-surface rounded-lg border p-4">
        <Insights {...view} visible={visible} hiddenCount={hidden.size} />
        <Toolbar series={series} hidden={hidden} onToggle={onToggle} title={props.title} />
        <div className={cn(long && '-mx-4 overflow-x-auto px-4')}>
          <div className={cn(long && 'min-w-[720px]')}>
            {/* Keyed on the period so a pinned column never points into the wrong range. */}
            <Plot
              key={current ?? 'data'}
              {...view}
              visible={visible}
              height={320}
              maxAxisLabels={long ? 20 : 14}
              tickIntervals={4}
            />
          </div>
        </div>
      </section>

      <section className="border-border bg-surface rounded-lg border">
        <h3 className="border-border border-b px-4 py-3 text-sm font-semibold">{t('table')}</h3>
        <div className="overflow-x-auto">
          <DataTable {...view} />
        </div>
      </section>
    </div>
  );
}

/** Every number in the chart; the full-screen view shows it, screen readers always get it. */
function DataTable({ title, data, series, format, unit = 'day' }: ColumnChartProps) {
  const t = useTranslations('charts');
  const showTotal = series.length > 1;
  const columnTotal = (key: string) =>
    data.reduce((sum, datum) => sum + Math.max(0, datum.values[key] ?? 0), 0);
  const rowTotal = (datum: ColumnDatum) =>
    series.reduce((sum, item) => sum + Math.max(0, datum.values[item.key] ?? 0), 0);

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{title}</caption>
      <thead className="bg-surface-muted text-foreground-muted text-left text-xs">
        <tr>
          <th scope="col" className="px-4 py-2 font-medium">
            {t(`column.${unit}`)}
          </th>
          {series.map((item) => (
            <th key={item.key} scope="col" className="px-4 py-2 text-right font-medium">
              {item.label}
            </th>
          ))}
          {showTotal && (
            <th scope="col" className="px-4 py-2 text-right font-medium">
              {t('total')}
            </th>
          )}
        </tr>
      </thead>
      <tbody className="divide-border divide-y">
        {data.map((datum, index) => (
          <tr key={datum.label + String(index)}>
            <th scope="row" className="px-4 py-2 text-left font-normal whitespace-nowrap">
              {datum.label}
            </th>
            {series.map((item) => (
              <td key={item.key} className="px-4 py-2 text-right tabular-nums">
                {format(datum.values[item.key] ?? 0)}
              </td>
            ))}
            {showTotal && (
              <td className="px-4 py-2 text-right font-medium tabular-nums">
                {format(rowTotal(datum))}
              </td>
            )}
          </tr>
        ))}
      </tbody>
      <tfoot className="border-border border-t-2 font-semibold">
        <tr>
          <th scope="row" className="px-4 py-2 text-left">
            {t('total')}
          </th>
          {series.map((item) => (
            <td key={item.key} className="px-4 py-2 text-right tabular-nums">
              {format(columnTotal(item.key))}
            </td>
          ))}
          {showTotal && (
            <td className="px-4 py-2 text-right tabular-nums">
              {format(series.reduce((sum, item) => sum + columnTotal(item.key), 0))}
            </td>
          )}
        </tr>
      </tfoot>
    </table>
  );
}

/** A column with rounded top corners and a square foot on the baseline. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  if (r <= 0) return `M${x},${y}h${w}v${h}h${-w}Z`;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
