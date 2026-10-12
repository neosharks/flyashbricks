import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/data-table';
import type { SaleRow } from '@/features/sales/types';
import { formatSaleNumber } from '@/lib/ids';
import { formatMoney } from '@/lib/money';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { SaleStatusBadge } from './sale-status-badge';

/**
 * Sales as tappable cards on a phone (customer, date, amount due big) and a
 * table from tablet width up. `header` lets the list page supply sortable
 * column headers; detail pages use the plain ones.
 */
export async function SalesList({
  rows,
  caption,
  showCustomer = true,
  header,
}: {
  rows: SaleRow[];
  caption: string;
  showCustomer?: boolean;
  header?: React.ReactNode;
}) {
  const [t, tc, locale] = await Promise.all([
    getTranslations('sales'),
    getTranslations('common'),
    getLocale(),
  ]);
  const money = (paise: number) => formatMoney(paise, locale);

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((sale) => (
          <li key={sale.id}>
            <Link
              href={`/sales/${sale.id}`}
              className={cn(
                'border-border bg-surface active:bg-surface-muted flex items-center gap-3 rounded-lg border p-4',
                sale.voided && 'opacity-60',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {showCustomer ? sale.customerName : formatSaleNumber(sale.number)}
                </p>
                <p className="text-foreground-muted text-sm">
                  {formatDate(sale.date, locale)} · {tc('bricks', { count: sale.bricks })}
                </p>
                <p className="text-foreground-muted text-xs tabular-nums">
                  {t('perBrick', { rate: money(sale.avgRatePaise) })}
                </p>
                <div className="mt-1">
                  <SaleStatusBadge status={sale.status} voided={sale.voided} />
                </div>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    'text-lg font-semibold tabular-nums',
                    sale.voided && 'line-through',
                  )}
                >
                  {money(sale.totalPaise)}
                </p>
                {!sale.voided && sale.duePaise > 0 && (
                  <p className="text-danger text-sm font-medium tabular-nums">
                    {t('columns.due')} {money(sale.duePaise)}
                  </p>
                )}
              </div>
              <ChevronRight aria-hidden className="text-foreground-subtle size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <Table caption={caption} minWidth="58rem">
          {header ?? (
            <THead>
              <TH>{t('columns.number')}</TH>
              <TH>{t('columns.date')}</TH>
              {showCustomer && <TH>{t('columns.customer')}</TH>}
              <TH align="right">{t('columns.bricks')}</TH>
              <TH align="right">{t('columns.rate')}</TH>
              <TH align="right">{t('columns.total')}</TH>
              <TH align="right">{t('columns.due')}</TH>
              <TH>{t('columns.status')}</TH>
            </THead>
          )}
          <TBody>
            {rows.map((sale) => (
              <TR key={sale.id} className={cn(sale.voided && 'opacity-60')}>
                <TD className="whitespace-nowrap">
                  <Link
                    href={`/sales/${sale.id}`}
                    className="hover:text-action font-medium tabular-nums"
                  >
                    {formatSaleNumber(sale.number)}
                  </Link>
                </TD>
                <TD muted className="whitespace-nowrap">
                  {formatDate(sale.date, locale)}
                </TD>
                {showCustomer && (
                  <TD>
                    <Link href={`/customers/${sale.customerId}`} className="hover:text-action">
                      {sale.customerName}
                    </Link>
                    <p className="text-foreground-muted max-w-56 truncate text-xs">
                      {sale.itemsSummary}
                    </p>
                  </TD>
                )}
                <TD align="right">{formatNumber(sale.bricks, locale)}</TD>
                <TD align="right" muted>
                  {money(sale.avgRatePaise)}
                </TD>
                <TD align="right" className={cn('font-medium', sale.voided && 'line-through')}>
                  {money(sale.totalPaise)}
                </TD>
                <TD
                  align="right"
                  className={cn(!sale.voided && sale.duePaise > 0 && 'text-danger font-medium')}
                >
                  {sale.voided ? '—' : money(sale.duePaise)}
                </TD>
                <TD>
                  <SaleStatusBadge status={sale.status} voided={sale.voided} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </>
  );
}
