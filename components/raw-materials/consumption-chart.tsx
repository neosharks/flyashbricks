'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ColumnChart, type ColumnDatum } from '@/components/charts/column-chart';
import { windowed, windowsFrom } from '@/components/charts/chart-math';
import { formatQuantity } from '@/lib/quantity';

type Day = { day: string; usedMilli: number; purchasedMilli?: number };

const RANGES = [7, 14, 30];

/**
 * Material used per day. Client wrapper: formatters are functions and cannot
 * cross from the server. Using more is not good or bad news by itself, so the
 * comparison with before is shown without a good/bad colour.
 */
export function ConsumptionChart({
  data,
  unit,
  history,
}: {
  data: Day[];
  unit: string;
  /** A longer run ending on the same day, for "compared with before" and the period switch. */
  history?: Day[];
}) {
  const t = useTranslations('rawMaterials.chart');
  const tc = useTranslations('charts');
  const locale = useLocale();
  const dayLabel = new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const amount = (milli: number) => `${formatQuantity(milli, locale)} ${unit}`;

  const toData = (days: Day[]): ColumnDatum[] =>
    days.map((point) => ({
      label: dayLabel.format(new Date(`${point.day}T00:00:00Z`)),
      values: { used: point.usedMilli },
      ...(point.purchasedMilli
        ? { details: [{ label: tc('stockArrived'), value: amount(point.purchasedMilli) }] }
        : {}),
    }));

  const used = (point: Day) => point.usedMilli;
  const ranges = history
    ? windowsFrom(history, RANGES, used).map((window) => ({
        key: String(window.length),
        label: tc('rangeDays', { count: window.length }),
        data: toData(window.current),
        previousTotal: window.previousTotal,
      }))
    : undefined;

  return (
    <ColumnChart
      title={t('title')}
      emptyLabel={t('empty')}
      series={[{ key: 'used', label: t('used'), color: 'chart-1' }]}
      data={toData(data)}
      format={amount}
      formatTick={(value) =>
        new Intl.NumberFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', { notation: 'compact' }).format(
          value / 1000,
        )
      }
      higherIsBetter={false}
      previousTotal={history ? windowed(history, data.length, used).previousTotal : null}
      {...(ranges ? { ranges, rangeKey: String(data.length) } : {})}
    />
  );
}
