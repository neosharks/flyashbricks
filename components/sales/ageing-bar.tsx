'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Clock } from 'lucide-react';
import { share } from '@/components/charts/chart-math';
import type { AgeingRow } from '@/features/sales/types';
import { formatMoney } from '@/lib/money';
import { cn, formatPercent } from '@/lib/utils';

/** Older money is more worrying, so age runs from the good to the critical status colour. */
const FILL: Record<AgeingRow['bucket'], string> = {
  d0_7: 'bg-status-good',
  d8_30: 'bg-status-warning',
  d31_60: 'bg-status-serious',
  d60: 'bg-status-critical',
};

/**
 * One segmented bar of everything owed, split by how long it has been owed.
 * Tapping a segment (or its legend row) spells out that slice: amount, bills
 * and share of the total. Every segment is also listed in words and figures,
 * so colour is never the only way to read it.
 */
export function AgeingBar({ rows }: { rows: AgeingRow[] }) {
  const t = useTranslations('sales.ageing');
  const tc = useTranslations('charts.ageing');
  const locale = useLocale();
  const [selected, setSelected] = useState<AgeingRow['bucket'] | null>(null);
  const total = rows.reduce((sum, row) => sum + row.duePaise, 0);

  if (total === 0) {
    return (
      <p className="text-success flex items-center gap-2 text-sm">
        <Clock aria-hidden className="size-4" />
        {t('empty')}
      </p>
    );
  }

  const percent = (paise: number) => formatPercent(share(paise, total), locale);
  const toggle = (bucket: AgeingRow['bucket']) =>
    setSelected((current) => (current === bucket ? null : bucket));
  const active = rows.find((row) => row.bucket === selected);

  return (
    <div>
      <div className="flex h-8 w-full gap-0.5 overflow-hidden rounded-lg">
        {rows
          .filter((row) => row.duePaise > 0)
          .map((row) => (
            <button
              key={row.bucket}
              type="button"
              aria-pressed={selected === row.bucket}
              aria-label={`${t(row.bucket)}: ${formatMoney(row.duePaise, locale)}`}
              onClick={() => toggle(row.bucket)}
              className={cn(
                'h-full min-w-2 transition-opacity',
                FILL[row.bucket],
                selected !== null && selected !== row.bucket && 'opacity-40',
              )}
              style={{ width: `${share(row.duePaise, total) * 100}%` }}
            />
          ))}
      </div>

      <p role="status" aria-live="polite" className="text-foreground-muted mt-2 min-h-5 text-xs">
        {active
          ? tc('detail', {
              bucket: t(active.bucket),
              amount: formatMoney(active.duePaise, locale),
              count: active.count,
              percent: percent(active.duePaise),
            })
          : tc('tapHint')}
      </p>

      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map((row) => (
          <li key={row.bucket}>
            <button
              type="button"
              aria-pressed={selected === row.bucket}
              onClick={() => toggle(row.bucket)}
              disabled={row.duePaise === 0}
              className={cn(
                'flex w-full items-start gap-2 rounded-md border p-2 text-left transition-colors disabled:opacity-60',
                selected === row.bucket
                  ? 'border-border-strong bg-surface-muted'
                  : 'hover:bg-surface-muted border-transparent',
              )}
            >
              <span
                aria-hidden
                className={cn('mt-1.5 size-2.5 shrink-0 rounded-sm', FILL[row.bucket])}
              />
              <span>
                <span className="text-foreground-muted block text-xs">{t(row.bucket)}</span>
                <span className="block font-semibold tabular-nums">
                  {formatMoney(row.duePaise, locale)}
                </span>
                <span className="text-foreground-muted block text-xs">
                  {t('bills', { count: row.count })} ·{' '}
                  {tc('share', { percent: percent(row.duePaise) })}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
