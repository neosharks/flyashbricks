'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ColumnChart, type ColumnDatum } from '@/components/charts/column-chart';
import { intlLocale, formatMoney, formatMoneyCompact } from '@/lib/money';

export type PaidBucket = {
  key: string;
  wage: number;
  advance: number;
  bonus: number;
  deduction: number;
};

/**
 * Money paid, stacked by type: wages, advances and bonuses are the three
 * series (the palette's three slots). Deductions are money taken back, not
 * paid out, so they appear in each column's details instead of as a bar.
 */
export function PaymentsChart({
  title,
  buckets,
  unit,
  previousTotal,
  emptyLabel,
}: {
  title: string;
  buckets: PaidBucket[];
  unit: 'day' | 'month';
  previousTotal?: number | null;
  emptyLabel?: string;
}) {
  const t = useTranslations('staff');
  const locale = useLocale();
  const label = new Intl.DateTimeFormat(intlLocale(locale), {
    ...(unit === 'day' ? { day: 'numeric', month: 'short' } : { month: 'short', year: '2-digit' }),
    timeZone: 'UTC',
  });

  const data: ColumnDatum[] = buckets.map((bucket) => ({
    label: label.format(new Date(`${unit === 'day' ? bucket.key : `${bucket.key}-01`}T00:00:00Z`)),
    values: { wage: bucket.wage, advance: bucket.advance, bonus: bucket.bonus },
    ...(bucket.deduction > 0
      ? {
          details: [
            { label: t('payments.chart.deductions'), value: formatMoney(bucket.deduction, locale) },
          ],
        }
      : {}),
  }));

  return (
    <ColumnChart
      title={title}
      data={data}
      unit={unit}
      series={[
        { key: 'wage', label: t('payment.types.wage'), color: 'chart-1' },
        { key: 'advance', label: t('payment.types.advance'), color: 'chart-2' },
        { key: 'bonus', label: t('payment.types.bonus'), color: 'chart-3' },
      ]}
      format={(paise) => formatMoney(paise, locale)}
      formatTick={(paise) => formatMoneyCompact(paise, locale)}
      emptyLabel={emptyLabel ?? t('payments.chart.empty')}
      // Paying out more is neither good nor bad; the change is shown without a verdict.
      higherIsBetter={false}
      {...(previousTotal !== undefined ? { previousTotal } : {})}
    />
  );
}
