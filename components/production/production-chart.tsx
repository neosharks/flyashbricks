'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ColumnChart, type ColumnDatum } from '@/components/charts/column-chart';
import { windowed, windowsFrom } from '@/components/charts/chart-math';
import type { ProductionDay } from '@/features/production/types';
import { formatNumber, formatPercent } from '@/lib/utils';

const RANGES = [7, 14, 30];
const made = (day: ProductionDay) => day.good + day.defective;

/**
 * Good (chart-1) and broken (chart-2) bricks per day, stacked.
 *
 * Pass `history` — a longer run of days ending on the same day as `data` — to
 * get "compared with before" and the 7 / 14 / 30 day switch in full screen.
 */
export function ProductionChart({
  data,
  history,
}: {
  data: ProductionDay[];
  history?: ProductionDay[];
}) {
  const t = useTranslations('production.chart');
  const tc = useTranslations('charts');
  const locale = useLocale();
  const dayLabel = new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const compact = new Intl.NumberFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    notation: 'compact',
  });

  const toData = (days: ProductionDay[]): ColumnDatum[] =>
    days.map((point) => ({
      label: dayLabel.format(new Date(`${point.day}T00:00:00Z`)),
      values: { good: point.good, defective: point.defective },
    }));

  const ranges = history
    ? windowsFrom(history, RANGES, made).map((window) => ({
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
      series={[
        { key: 'good', label: t('good'), color: 'chart-1' },
        { key: 'defective', label: t('defective'), color: 'chart-2' },
      ]}
      data={toData(data)}
      format={(value) => formatNumber(value, locale)}
      formatTick={(value) => compact.format(value)}
      previousTotal={history ? windowed(history, data.length, made).previousTotal : null}
      {...(ranges ? { ranges, rangeKey: String(data.length) } : {})}
      extraInsights={(shown) => {
        const good = shown.reduce((sum, point) => sum + (point.values.good ?? 0), 0);
        const broken = shown.reduce((sum, point) => sum + (point.values.defective ?? 0), 0);
        return good + broken > 0
          ? [{ label: tc('brokenRate'), value: formatPercent(broken / (good + broken), locale) }]
          : [];
      }}
    />
  );
}
