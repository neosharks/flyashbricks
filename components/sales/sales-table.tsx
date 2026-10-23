import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';
import { ClickableRow, PanelLink } from '@/components/ui/clickable-row';
import { SELECTED_CARD } from '@/components/ui/selection';
import { Table, TBody, TD, TH, THead } from '@/components/ui/data-table';
import type { SaleRow } from '@/features/sales/types';
import { formatSaleNumber } from '@/lib/ids';
import { formatMoney } from '@/lib/money';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { SaleStatusBadge } from './sale-status-badge';

/**
 * Sales as tappable cards where room is short (a phone, or the list beside an
 * open record) and a table where it is not. `header` lets the list page supply
 * sortable column headers; detail pages use the plain ones. With `panelHref`
 * a sale opens beside the list on a wide screen; `openId` marks that one.
 */
export async function SalesList({
  rows,
  caption,
  showCustomer = true,
  header,
  panelHref,
  openId = null,
}: {
  rows: SaleRow[];
  caption: string;
  showCustomer?: boolean;
  header?: React.ReactNode;
  panelHref?: ((id: string) => string) | undefined;
  openId?: string | null;
}) {
  const [t, tc, locale] = await Promise.all([
    getTranslations('sales'),
    getTranslations('common'),
    getLocale(),
  ]);
  const money = (paise: number) => formatMoney(paise, locale);

  return (
    <>
      <ul className="flex flex-col gap-2 @2xl:hidden">
        {rows.map((sale) => (
          <li key={sale.id}>
            <PanelLink
              href={`/sales/${sale.id}`}
              panelHref={panelHref?.(sale.id)}
              className={cn(
                'border-border bg-surface hover:bg-surface-muted active:bg-surface-muted flex items-center gap-3 rounded-lg border p-4',
                sale.voided && 'opacity-60',
                sale.id === openId && SELECTED_CARD,
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
            </PanelLink>
          </li>
        ))}
      </ul>

      <div className="hidden @2xl:block">
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
              <ClickableRow
                key={sale.id}
                href={`/sales/${sale.id}`}
                panelHref={panelHref?.(sale.id)}
                selected={sale.id === openId}
                className={cn(sale.voided && 'opacity-60')}
              >
                <TD className="whitespace-nowrap">
                  <PanelLink
                    href={`/sales/${sale.id}`}
                    panelHref={panelHref?.(sale.id)}
                    className="hover:text-action font-medium tabular-nums"
                  >
                    {formatSaleNumber(sale.number)}
                  </PanelLink>
                </TD>
                <TD muted className="whitespace-nowrap">
                  {formatDate(sale.date, locale)}
                </TD>
                {showCustomer && (
                  <TD>
                    <Link
                      href={`/customers/${sale.customerId}`}
                      className="hover:text-action hover:underline"
                    >
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
              </ClickableRow>
            ))}
          </TBody>
        </Table>
      </div>
    </>
  );
}
