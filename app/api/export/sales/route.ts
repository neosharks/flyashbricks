import { getTranslations } from 'next-intl/server';
import { connectDb } from '@/lib/db';
import { formatSaleNumber } from '@/lib/ids';
import { parseTableParams } from '@/lib/table';
import { csvRupees } from '@/features/sales/csv';
import { usualRate } from '@/features/sales/totals';
import { csvResponse, exportGate, MAX_EXPORT_ROWS } from '@/features/sales/export';
import { parseSalesFilters } from '@/features/sales/filters';
import { getOrgTimezone } from '@/lib/org';
import { SALE_SORTS, salesFilter } from '@/features/sales/queries';
import { dayKey } from '@/lib/dates';
import { Sale } from '@/models/sale';

export const dynamic = 'force-dynamic';

/** The sales list as CSV, with the same filters and order as the screen. */
export async function GET(request: Request): Promise<Response> {
  const gate = await exportGate();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  await connectDb();
  const query = Object.fromEntries(new URL(request.url).searchParams.entries());
  const timeZone = await getOrgTimezone(user.orgId);
  const filters = parseSalesFilters(query, timeZone);
  const params = parseTableParams(query, SALE_SORTS, { sort: 'date', dir: 'desc' });
  const [t, tb] = await Promise.all([
    getTranslations('sales'),
    getTranslations('common.bilingual'),
  ]);
  const direction = params.dir === 'asc' ? 1 : -1;

  const cursor = Sale.find(salesFilter(user, filters, params.q, timeZone))
    .sort({ [params.sort]: direction, _id: direction })
    .limit(MAX_EXPORT_ROWS)
    .lean()
    .cursor();

  // Amounts are plain rupee numbers (₹ in the heading) so the spreadsheet can add them up.
  return csvResponse({
    user,
    action: 'sale.export',
    entity: 'Sale',
    filename: `sales-${dayKey(new Date(), timeZone)}.csv`,
    filters: { ...filters, q: params.q },
    header: [
      t('columns.number'),
      t('invoice.number'),
      t('columns.date'),
      t('columns.customer'),
      tb('inHindi', { label: t('columns.customer') }),
      t('form.customerPhone'),
      t('columns.bricks'),
      `${t('columns.rate')} (₹)`,
      `${t('csv.usualRate')} (₹)`,
      t('detail.item'),
      `${t('invoice.taxable')} (₹)`,
      `GST (₹)`,
      `${t('columns.total')} (₹)`,
      `${t('columns.paid')} (₹)`,
      `${t('columns.due')} (₹)`,
      t('columns.status'),
    ],
    cursor,
    toRow: (sale) => [
      formatSaleNumber(sale.number),
      sale.invoiceNumber,
      dayKey(sale.date, timeZone),
      sale.customerName,
      sale.customerNameHi,
      sale.customerPhone,
      sale.bricks,
      csvRupees(sale.avgRatePaise),
      csvRupees(usualRate(sale.lines)),
      sale.lines
        .map(
          (line) =>
            `${line.productName}${line.productNameHi ? ` (${line.productNameHi})` : ''} × ${line.qty} @ ${csvRupees(line.ratePaise)}`,
        )
        .join('; '),
      csvRupees(sale.taxablePaise),
      csvRupees(sale.taxPaise),
      csvRupees(sale.totalPaise),
      csvRupees(sale.voidedAt ? 0 : sale.paidPaise),
      csvRupees(sale.voidedAt ? 0 : sale.duePaise),
      sale.voidedAt ? t('status.voided') : t(`status.${sale.status}`),
    ],
  });
}
