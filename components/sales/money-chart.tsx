'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ColumnChart, type ColumnDatum } from '@/components/charts/column-chart';
import { windowed, windowsFrom } from '@/components/charts/chart-math';
import { formatMoney, formatMoneyCompact } from '@/lib/money';
import { formatNumber } from '@/lib/utils';

export type MoneyPoint = { label: string; paise: number; bricks?: number; avgRatePaise?: number };

/**
 * A single-series money chart. Formatting functions cannot cross from a Server
 * Component into a Client Component, so the server passes plain numbers and
 * this wrapper supplies the rupee formatting.
 *
 * `history` — a longer run ending on the same point as `data` — adds
 * "compared with before" and the period switch (`rangeLengths`) in full screen.
 */
export function MoneyColumnChart({
  title,
  seriesLabel,
  data,
  emptyLabel,
  maxAxisLabels,
  unit = 'day',
  history,
  rangeLengths = unit === 'day' ? [7, 14, 30] : [3, 6, 12],
}: {
  title: string;
  seriesLabel: string;
  data: MoneyPoint[];
  emptyLabel: string;
  maxAxisLabels?: number;
  unit?: 'day' | 'month';
  history?: MoneyPoint[];
  rangeLengths?: number[];
}) {
  const locale = useLocale();
  const t = useTranslations('charts');
  const ts = useTranslations('sales.chart');

  const toData = (points: MoneyPoint[]): ColumnDatum[] =>
    points.map((point) => ({
      label: point.label,
      values: { value: point.paise },
      ...(point.bricks === undefined
        ? {}
        : {
            details: [
              { label: t('bricks'), value: formatNumber(point.bricks, locale) },
              // The price only means something on a day bricks were sold.
              ...(point.avgRatePaise && point.bricks > 0
                ? [{ label: ts('avgRate'), value: formatMoney(point.avgRatePaise, locale) }]
                : []),
            ],
          }),
    }));

  const ranges = history
    ? windowsFrom(history, rangeLengths, (point) => point.paise).map((window) => ({
        key: String(window.length),
        label:
          unit === 'day'
            ? t('rangeDays', { count: window.length })
            : t('rangeMonths', { count: window.length }),
        data: toData(window.current),
        previousTotal: window.previousTotal,
      }))
    : undefined;

  return (
    <ColumnChart
      title={title}
      data={toData(data)}
      series={[{ key: 'value', label: seriesLabel, color: 'chart-1' }]}
      format={(paise) => formatMoney(paise, locale)}
      formatTick={(paise) => formatMoneyCompact(paise, locale)}
      emptyLabel={emptyLabel}
      unit={unit}
      previousTotal={
        history ? windowed(history, data.length, (point) => point.paise).previousTotal : null
      }
      {...(ranges ? { ranges, rangeKey: String(data.length) } : {})}
      {...(maxAxisLabels ? { maxAxisLabels } : {})}
    />
  );
}
