import { getLocale, getTranslations } from 'next-intl/server';
import { pickText } from '@/lib/bilingual';
import { GroupedTable, type GroupColumn, type GroupRow } from '@/components/ui/grouped-table';
import { tableHref, type QueryState } from '@/lib/table-href';
import {
  DUES_BRACKETS,
  RECENCY_BUCKETS,
  type CustomerGroup,
  type CustomerGroupRow,
} from '@/features/customers/types';

/** The customers list in "group by" mode; each group opens the list filtered to it. */
export async function CustomerGroups({
  by,
  rows,
  query,
}: {
  by: CustomerGroup;
  rows: CustomerGroupRow[];
  query: QueryState;
}) {
  const [t, locale] = await Promise.all([getTranslations('customers'), getLocale()]);
  const link = (overrides: Record<string, string | null>) =>
    tableHref('/customers', query, { group: null, ...overrides });

  const describe = (row: CustomerGroupRow): Pick<GroupRow, 'label' | 'href'> => {
    switch (by) {
      case 'city':
        return {
          label: row.key === '—' ? t('group.noCity') : pickText(row.key, row.keyHi, locale),
          href: link({ city: row.key }),
        };
      case 'dues': {
        const bracket = DUES_BRACKETS.find((value) => value === row.key) ?? 'none';
        return { label: t(`dues.${bracket}`), href: link({ bracket }) };
      }
      case 'recency': {
        const bucket = RECENCY_BUCKETS.find((value) => value === row.key) ?? 'never';
        return { label: t(`recency.${bucket}`), href: link({ recency: bucket }) };
      }
    }
  };

  const columns: GroupColumn[] = [
    { key: 'customers', label: t('group.customers'), format: 'number' },
    { key: 'bills', label: t('group.bills'), format: 'number' },
    { key: 'bricks', label: t('group.bricks'), format: 'number' },
    { key: 'billed', label: t('group.billed'), format: 'money', bar: true },
    { key: 'pending', label: t('group.pending'), format: 'money' },
  ];

  const groupRows: GroupRow[] = rows.map((row) => ({
    key: row.key,
    ...describe(row),
    values: {
      customers: row.customers,
      bills: row.bills,
      bricks: row.bricks,
      billed: row.billedPaise,
      pending: row.duePaise,
    },
  }));

  const sum = (pick: (row: CustomerGroupRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);

  return (
    <GroupedTable
      caption={t('group.caption', { group: t(`group.${by}`) })}
      groupLabel={t(`group.${by}`)}
      columns={columns}
      rows={groupRows}
      totals={{
        customers: sum((row) => row.customers),
        bills: sum((row) => row.bills),
        bricks: sum((row) => row.bricks),
        billed: sum((row) => row.billedPaise),
        pending: sum((row) => row.duePaise),
      }}
    />
  );
}
