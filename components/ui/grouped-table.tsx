'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { cn, formatNumber, formatPercent } from '@/lib/utils';

export type GroupColumn = {
  key: string;
  label: string;
  format: 'money' | 'number' | 'percent' | 'text';
  /** Drawn as a bar behind the value, scaled to the largest group. One column at most. */
  bar?: boolean;
};

export type GroupRow = {
  key: string;
  label: string;
  sublabel?: string;
  /** Opens the list filtered to this group. */
  href?: string;
  values: Record<string, number | string>;
};

/**
 * "Group by" results: one row per group with its subtotals, a totals row, and
 * sortable columns. Groups are few (days in a range, customers, brick types),
 * so sorting happens in the browser and needs no round trip.
 *
 * Phones get one card per group with the bar-column value large; wider
 * screens get the table. Every group links to the matching filtered list.
 */
export function GroupedTable({
  caption,
  groupLabel,
  columns,
  rows,
  totals,
}: {
  caption: string;
  groupLabel: string;
  columns: GroupColumn[];
  rows: GroupRow[];
  totals?: Record<string, number | string>;
}) {
  const t = useTranslations('common.table');
  const locale = useLocale();
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const format = (column: GroupColumn, value: number | string | undefined): string => {
    if (value === undefined || value === '') return '—';
    if (typeof value === 'string') return value;
    switch (column.format) {
      case 'money':
        return formatMoney(value, locale);
      case 'percent':
        return formatPercent(value, locale);
      case 'number':
        return formatNumber(value, locale);
      case 'text':
        return String(value);
    }
  };

  const barColumn = columns.find((column) => column.bar);
  const barMax = barColumn
    ? Math.max(1, ...rows.map((row) => Number(row.values[barColumn.key] ?? 0)))
    : 1;

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = sort.key === '__label' ? a.label : a.values[sort.key];
      const right = sort.key === '__label' ? b.label : b.values[sort.key];
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
      return String(left ?? '').localeCompare(String(right ?? ''), locale) * factor;
    });
  }, [rows, sort, locale]);

  const header = (key: string, label: string, align: 'left' | 'right') => {
    const active = sort?.key === key;
    const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th
        key={key}
        scope="col"
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn(
          'px-3 py-2.5 font-medium whitespace-nowrap',
          align === 'right' && 'text-right',
        )}
      >
        <button
          type="button"
          onClick={() =>
            setSort((current) =>
              current?.key === key
                ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: key === '__label' ? 'asc' : 'desc' },
            )
          }
          className={cn(
            'hover:text-foreground inline-flex items-center gap-1 uppercase',
            active && 'text-foreground',
            align === 'right' && 'flex-row-reverse',
          )}
          aria-label={t('sortBy', { column: label })}
        >
          {label}
          <Icon aria-hidden className={cn('size-3.5', !active && 'opacity-40')} />
        </button>
      </th>
    );
  };

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {sorted.map((row) => {
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.label}</p>
                  {row.sublabel && <p className="text-foreground-muted text-xs">{row.sublabel}</p>}
                </div>
                {barColumn && (
                  <p className="text-lg font-semibold tabular-nums">
                    {format(barColumn, row.values[barColumn.key])}
                  </p>
                )}
              </div>
              {barColumn && (
                <div
                  className="bg-surface-muted mt-2 h-1.5 overflow-hidden rounded-full"
                  aria-hidden
                >
                  <div
                    className="bg-chart-1 h-full rounded-full"
                    style={{ width: `${(Number(row.values[barColumn.key] ?? 0) / barMax) * 100}%` }}
                  />
                </div>
              )}
              <dl className="text-foreground-muted mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {columns
                  .filter((column) => column !== barColumn)
                  .map((column) => (
                    <div key={column.key} className="flex justify-between gap-2">
                      <dt>{column.label}</dt>
                      <dd className="text-foreground tabular-nums">
                        {format(column, row.values[column.key])}
                      </dd>
                    </div>
                  ))}
              </dl>
            </>
          );
          return (
            <li key={row.key}>
              {row.href ? (
                <Link
                  href={row.href}
                  className="border-border bg-surface active:bg-surface-muted block rounded-lg border p-4"
                >
                  {content}
                </Link>
              ) : (
                <div className="border-border bg-surface rounded-lg border p-4">{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="border-border bg-surface hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-muted text-foreground-muted border-border border-b text-left text-xs font-medium tracking-wide uppercase">
            <tr>
              {header('__label', groupLabel, 'left')}
              {columns.map((column) =>
                header(column.key, column.label, column.format === 'text' ? 'left' : 'right'),
              )}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {sorted.map((row) => (
              <tr key={row.key} className="hover:bg-surface-muted/60">
                <th scope="row" className="px-3 py-3 text-left font-medium">
                  {row.href ? (
                    <Link
                      href={row.href}
                      className="hover:text-action inline-flex items-center gap-1"
                    >
                      {row.label}
                      <ChevronRight aria-hidden className="size-3.5 opacity-50" />
                    </Link>
                  ) : (
                    row.label
                  )}
                  {row.sublabel && (
                    <span className="text-foreground-muted block text-xs font-normal">
                      {row.sublabel}
                    </span>
                  )}
                </th>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-3 py-3 tabular-nums',
                      column.format !== 'text' && 'text-right',
                    )}
                  >
                    {column.bar ? (
                      <span className="relative inline-flex min-w-28 justify-end">
                        <span
                          aria-hidden
                          className="bg-chart-1/15 absolute inset-y-0 right-0 rounded"
                          style={{
                            width: `${(Number(row.values[column.key] ?? 0) / barMax) * 100}%`,
                          }}
                        />
                        <span className="relative px-1">
                          {format(column, row.values[column.key])}
                        </span>
                      </span>
                    ) : (
                      format(column, row.values[column.key])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot className="border-border bg-surface-muted border-t font-semibold">
              <tr>
                <th scope="row" className="px-3 py-3 text-left">
                  {t('total')}
                </th>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-3 py-3 tabular-nums',
                      column.format !== 'text' && 'text-right',
                    )}
                  >
                    {format(column, totals[column.key])}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
