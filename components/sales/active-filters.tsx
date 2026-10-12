import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { X } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { tableHref, type QueryState } from '@/lib/table-href';
import type { SalesFilters } from '@/features/sales/filters';
import { PRICE_BAND_PAISE } from '@/features/sales/totals';

/**
 * Chips for the narrower filters a group link applies (one customer, one
 * brick type, one price band), each with an ✕ that removes just that filter.
 * Without them, a list opened from a group would look filtered for no reason.
 */
export async function SalesActiveFilters({
  filters,
  names,
  query,
}: {
  filters: SalesFilters;
  names: { customer: string | null; product: string | null };
  query: QueryState;
}) {
  const [t, locale] = await Promise.all([getTranslations('sales.filtersActive'), getLocale()]);
  const chips: { key: string; label: string }[] = [];
  if (filters.customerId)
    chips.push({ key: 'customer', label: t('customer', { name: names.customer ?? '—' }) });
  if (filters.productId)
    chips.push({ key: 'product', label: t('product', { name: names.product ?? '—' }) });
  if (filters.rateBand !== null) {
    chips.push({
      key: 'rate',
      label: t('rate', {
        band: `${formatMoney(filters.rateBand, locale)} – ${formatMoney(filters.rateBand + PRICE_BAND_PAISE - 1, locale)}`,
      }),
    });
  }
  if (chips.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            href={tableHref('/sales', query, { [chip.key]: null })}
            className="bg-action-subtle text-action inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium sm:min-h-9"
          >
            {chip.label}
            <X aria-hidden className="size-3.5" />
            <span className="sr-only">{t('clear')}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
