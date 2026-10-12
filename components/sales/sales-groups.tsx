import { getLocale, getTranslations } from 'next-intl/server';
import { GroupedTable, type GroupColumn, type GroupRow } from '@/components/ui/grouped-table';
import { addDays } from '@/lib/dates';
import { formatMoney, intlLocale } from '@/lib/money';
import { tableHref, type QueryState } from '@/lib/table-href';
import { formatDate } from '@/lib/utils';
import { PRICE_BAND_PAISE } from '@/features/sales/totals';
import type { SaleGroup, SaleGroupRow } from '@/features/sales/types';

const STATUS_KEYS = ['unpaid', 'partial', 'paid', 'voided'] as const;

function lastDayOfMonth(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, monthIndex ?? 1, 0)).toISOString().slice(0, 10);
}

/**
 * The sales list in "group by" mode: one row of subtotals per group, each
 * linking back to the list filtered to just that group, so the numbers are
 * always one tap from the bills behind them.
 */
export async function SalesGroups({
  by,
  rows,
  query,
}: {
  by: SaleGroup;
  rows: SaleGroupRow[];
  query: QueryState;
}) {
  const [t, locale] = await Promise.all([getTranslations('sales'), getLocale()]);
  const money = (paise: number) => formatMoney(paise, locale);
  const monthFormat = new Intl.DateTimeFormat(intlLocale(locale), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  // Every group link drops the grouping and any page cursor, keeping the other filters.
  const link = (overrides: Record<string, string | null>) =>
    tableHref('/sales', query, { group: null, ...overrides });

  const describe = (row: SaleGroupRow): Pick<GroupRow, 'label' | 'href'> => {
    switch (by) {
      case 'day':
        return {
          label: formatDate(`${row.key}T00:00:00Z`, locale, 'UTC'),
          href: link({ range: 'custom', from: row.key, to: row.key }),
        };
      case 'week':
        return {
          label: t('group.weekOf', { date: formatDate(`${row.key}T00:00:00Z`, locale, 'UTC') }),
          href: link({ range: 'custom', from: row.key, to: addDays(row.key, 6) }),
        };
      case 'month':
        return {
          label: monthFormat.format(new Date(`${row.key}-01T00:00:00Z`)),
          href: link({ range: 'custom', from: `${row.key}-01`, to: lastDayOfMonth(row.key) }),
        };
      case 'customer':
        return { label: row.name ?? '—', href: link({ customer: row.key }) };
      case 'product':
        return { label: row.name ?? '—', href: link({ product: row.key }) };
      case 'status': {
        const status = STATUS_KEYS.find((key) => key === row.key) ?? 'unpaid';
        return { label: t(`status.${status}`), href: link({ status }) };
      }
      case 'price': {
        const from = Number(row.key);
        return {
          label: t('group.band', { from: money(from), to: money(from + PRICE_BAND_PAISE - 1) }),
          href: link({ rate: row.key }),
        };
      }
    }
  };

  const avgRate = (row: { subtotalPaise: number; bricks: number }) =>
    row.bricks > 0 ? Math.round(row.subtotalPaise / row.bricks) : 0;

  const moneyColumns: GroupColumn[] =
    by === 'product'
      ? [{ key: 'value', label: t('group.goodsValue'), format: 'money', bar: true }]
      : [
          { key: 'value', label: t('group.value'), format: 'money', bar: true },
          { key: 'received', label: t('group.received'), format: 'money' },
          { key: 'pending', label: t('group.pending'), format: 'money' },
        ];
  const columns: GroupColumn[] = [
    { key: 'bills', label: t('group.bills'), format: 'number' },
    { key: 'bricks', label: t('group.bricks'), format: 'number' },
    { key: 'avgRate', label: t('group.avgRate'), format: 'money' },
    ...moneyColumns,
  ];

  const groupRows: GroupRow[] = rows.map((row) => ({
    key: row.key,
    ...describe(row),
    values: {
      bills: row.bills,
      bricks: row.bricks,
      avgRate: avgRate(row),
      value: row.totalPaise ?? row.subtotalPaise,
      ...(row.paidPaise === null ? {} : { received: row.paidPaise }),
      ...(row.duePaise === null ? {} : { pending: row.duePaise }),
    },
  }));

  const sum = (pick: (row: SaleGroupRow) => number | null) =>
    rows.reduce((total, row) => total + (pick(row) ?? 0), 0);
  const totalBricks = sum((row) => row.bricks);
  const totals: Record<string, number | string> = {
    bills: sum((row) => row.bills),
    bricks: totalBricks,
    avgRate: avgRate({ subtotalPaise: sum((row) => row.subtotalPaise), bricks: totalBricks }),
    value: sum((row) => row.totalPaise ?? row.subtotalPaise),
    ...(by === 'product'
      ? {}
      : { received: sum((row) => row.paidPaise), pending: sum((row) => row.duePaise) }),
  };

  return (
    <div className="flex flex-col gap-2">
      <GroupedTable
        caption={t('group.caption', { group: t(`group.${by}`) })}
        groupLabel={t(`group.${by}`)}
        columns={columns}
        rows={groupRows}
        totals={totals}
      />
      {by === 'product' && (
        <p className="text-foreground-muted text-xs">{t('group.productNote')}</p>
      )}
    </div>
  );
}
