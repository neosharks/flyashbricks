import { ClickableRow } from '@/components/ui/clickable-row';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  HandCoins,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
  ShoppingCart,
  Tag,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { SortSelect } from '@/components/ui/sort-select';
import { TableSearch } from '@/components/ui/table-search';
import {
  NoResults,
  Pagination,
  SortableTH,
  Table,
  TBody,
  TD,
  TH,
  THead,
} from '@/components/ui/data-table';
import { PrefixedPills } from '@/components/customers/prefixed-pills';
import { CustomerDialogButton } from '@/components/customers/customer-dialog';
import { MoneyColumnChart } from '@/components/sales/money-chart';
import { SalesList } from '@/components/sales/sales-table';
import { getCustomer } from '@/features/customers/queries';
import { getOrgSummary } from '@/lib/org';
import {
  CUSTOMER_PAYMENT_SORTS,
  customerMonthly,
  customerPriceStats,
  listCustomerPayments,
  listSales,
  SALE_SORTS,
} from '@/features/sales/queries';
import { STATUS_FILTERS } from '@/features/sales/filters';
import { parseTableParams } from '@/lib/table';
import { GST_STATES } from '@/lib/gst';
import { formatSaleNumber } from '@/lib/ids';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { formatPhone } from '@/lib/phone';
import { requirePermissionPage } from '@/lib/session';
import { formatDate, formatNumber } from '@/lib/utils';
import { DetailFrame, type DetailVariant } from '@/components/ui/detail-frame';
import { PanelMissing } from '@/components/ui/split-view';

type SearchParams = Record<string, string | string[] | undefined>;

/** The two tables on this page keep separate URL state: `sales_*` and `pay_*`. */
const SALES = 'sales_';
const PAY = 'pay_';

/**
 * One customer: what they bought, paid and still owe. The same record shows as its own page and in the
 * panel beside the list; in the panel it ignores the list's query.
 */
export async function CustomerDetail({
  id,
  query = {},
  variant = 'page',
}: {
  id: string;
  query?: SearchParams;
  variant?: DetailVariant;
}) {
  const viewer = await requirePermissionPage(`/customers/${id}`, 'sales:read');
  const org = await getOrgSummary(viewer.orgId);
  const basePath = `/customers/${id}`;

  const salesParams = parseTableParams(
    query,
    SALE_SORTS,
    { sort: 'date', dir: 'desc', size: 10 },
    SALES,
  );
  const payParams = parseTableParams(
    query,
    CUSTOMER_PAYMENT_SORTS,
    { sort: 'paidAt', dir: 'desc', size: 10 },
    PAY,
  );
  const rawStatus = Array.isArray(query[`${SALES}status`])
    ? query[`${SALES}status`]?.[0]
    : query[`${SALES}status`];
  const status = STATUS_FILTERS.find((value) => value === rawStatus) ?? null;
  const validId = /^[a-f\d]{24}$/i.test(id);

  const [customer, sales, payments, prices, monthly, t, ts, locale] = await Promise.all([
    getCustomer(viewer, id),
    validId
      ? listSales(
          viewer,
          salesParams,
          {
            range: null,
            from: null,
            to: null,
            status,
            customerId: id,
            productId: null,
            rateBand: null,
          },
          org.timezone,
        )
      : null,
    validId ? listCustomerPayments(viewer, id, payParams) : null,
    validId ? customerPriceStats(viewer, id) : null,
    customerMonthly(viewer, id, org.timezone),
    getTranslations('customers'),
    getTranslations('sales'),
    getLocale(),
  ]);
  if (!customer || !sales || !payments || !prices) {
    if (variant === 'panel') return <PanelMissing />;
    notFound();
  }

  const canWrite = can(viewer, 'sales:write');
  const money = (paise: number) => formatMoney(paise, locale);
  const monthLabel = new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    month: 'short',
    timeZone: 'UTC',
  });
  const monthlyPoints = monthly.map((point) => ({
    label: monthLabel.format(new Date(`${point.month}-01T00:00:00Z`)),
    paise: point.totalPaise,
    bricks: point.bricks,
  }));
  const salesFiltered = salesParams.q !== '' || status !== null;

  return (
    <DetailFrame variant={variant} size="medium">
      <PageHeader
        title={customer.name}
        description={t('detail.since', { date: formatDate(customer.createdAt, locale) })}
        back={variant === 'page' ? { href: '/customers', label: t('title') } : undefined}
        actions={
          canWrite && (
            <>
              <Button asChild size="lg" className="w-full @xl:w-auto">
                <Link href={`/sales/new?customer=${customer.id}`}>
                  <ShoppingCart aria-hidden />
                  {t('detail.newSale')}
                </Link>
              </Button>
              <CustomerDialogButton customer={customer} variant="outline">
                <Pencil aria-hidden />
                {t('detail.edit')}
              </CustomerDialogButton>
            </>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 @4xl:grid-cols-4">
        <StatCard
          label={t('detail.due')}
          value={money(customer.duePaise)}
          icon={HandCoins}
          tone={customer.duePaise > 0 ? 'danger' : 'success'}
          hint={customer.duePaise > 0 ? t('detail.dueTone') : t('detail.settled')}
          className="col-span-2 @4xl:col-span-1"
        />
        <StatCard label={t('detail.billed')} value={money(customer.billedPaise)} />
        <StatCard
          label={t('detail.paid')}
          value={money(customer.paidPaise)}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label={t('detail.bricksBought')}
          value={formatNumber(customer.bricksBought, locale)}
          hint={`${t('detail.saleCount')}: ${formatNumber(customer.saleCount, locale)} · ${t('detail.lastSale')}: ${customer.lastSaleAt ? formatDate(customer.lastSaleAt, locale) : t('detail.noSales')}`}
          className="col-span-2 @4xl:col-span-1"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.contact')}</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3 text-sm">
              <ul className="flex flex-col gap-2">
                {customer.phones.map((phone) => (
                  <li key={phone}>
                    <a
                      href={`tel:+91${phone}`}
                      className="border-border hover:bg-surface-muted flex min-h-12 items-center gap-3 rounded-md border px-3 text-base font-medium tabular-nums"
                      aria-label={t('detail.call', { phone: formatPhone(phone) })}
                    >
                      <Phone aria-hidden className="text-action size-4" />
                      {formatPhone(phone)}
                    </a>
                  </li>
                ))}
              </ul>
              {(customer.address ?? customer.city) && (
                <p className="flex gap-2">
                  <MapPin aria-hidden className="text-foreground-muted mt-0.5 size-4 shrink-0" />
                  <span>{[customer.address, customer.city].filter(Boolean).join(', ')}</span>
                </p>
              )}
              {customer.stateCode && (
                <p>
                  <span className="text-foreground-muted">{t('detail.state')}: </span>
                  {GST_STATES[customer.stateCode]}
                </p>
              )}
              {customer.gstin && (
                <p>
                  <span className="text-foreground-muted">{t('detail.gstin')}: </span>
                  <span className="font-mono">{customer.gstin}</span>
                </p>
              )}
              {customer.notes && (
                <p className="bg-surface-muted rounded-md p-3 whitespace-pre-line">
                  {customer.notes}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag aria-hidden className="text-foreground-muted size-4" />
                {t('detail.usualPrice')}
              </CardTitle>
              <p className="text-foreground-muted text-xs">{t('detail.usualPriceHint')}</p>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-foreground-muted text-xs">{t('detail.usualPrice')}</dt>
                  <dd className="text-xl font-semibold tabular-nums">
                    {prices.avgRatePaise === null
                      ? t('detail.noPrice')
                      : ts('perBrick', { rate: money(prices.avgRatePaise) })}
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground-muted text-xs">{t('detail.lastPrice')}</dt>
                  <dd className="text-xl font-semibold tabular-nums">
                    {prices.lastRatePaise === null
                      ? t('detail.noPrice')
                      : ts('perBrick', { rate: money(prices.lastRatePaise) })}
                  </dd>
                  {prices.lastSaleAt && (
                    <dd className="text-foreground-muted text-xs">
                      {formatDate(prices.lastSaleAt, locale)}
                    </dd>
                  )}
                </div>
              </dl>
            </CardBody>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.monthly')}</CardTitle>
            </CardHeader>
            <CardBody>
              <MoneyColumnChart
                title={t('detail.monthly')}
                seriesLabel={t('detail.monthlyValue')}
                emptyLabel={t('detail.monthlyEmpty')}
                maxAxisLabels={12}
                unit="month"
                data={monthlyPoints}
                history={monthlyPoints}
                rangeLengths={[3, 6, 12]}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      <section className="mt-8" aria-labelledby="purchase-history">
        <h2 id="purchase-history" className="mb-3 text-base font-semibold">
          {t('detail.sales')}
        </h2>
        <div className="mb-3 flex flex-col gap-3 @4xl:flex-row @4xl:items-center @4xl:justify-between">
          <TableSearch placeholder={t('detail.salesSearch')} prefix={SALES} />
          <PrefixedPills
            label={ts('statusFilter.label')}
            param="status"
            prefix={SALES}
            basePath={basePath}
            query={query}
            options={[
              { value: null, label: ts('statusFilter.all') },
              { value: 'due', label: ts('statusFilter.due') },
              { value: 'paid', label: ts('statusFilter.paid') },
              { value: 'voided', label: ts('statusFilter.voided') },
            ]}
          />
          <SortSelect
            className="@3xl:hidden"
            prefix={SALES}
            sort={salesParams.sort}
            dir={salesParams.dir}
            options={[
              { sort: 'date', dir: 'desc', label: ts('sort.newest') },
              { sort: 'date', dir: 'asc', label: ts('sort.oldest') },
              { sort: 'totalPaise', dir: 'desc', label: ts('sort.highestTotal') },
              { sort: 'duePaise', dir: 'desc', label: ts('sort.mostDue') },
              { sort: 'avgRatePaise', dir: 'desc', label: ts('sort.highestRate') },
              { sort: 'avgRatePaise', dir: 'asc', label: ts('sort.lowestRate') },
            ]}
          />
        </div>
        {sales.rows.length === 0 ? (
          salesFiltered ? (
            <NoResults />
          ) : (
            <p className="border-border text-foreground-muted rounded-lg border border-dashed p-6 text-center text-sm">
              {t('detail.salesEmpty')}
            </p>
          )
        ) : (
          <>
            <SalesList
              rows={sales.rows}
              caption={t('detail.sales')}
              showCustomer={false}
              header={
                <THead>
                  <TH>{ts('columns.number')}</TH>
                  <SortableTH
                    prefix={SALES}
                    column="date"
                    label={ts('columns.date')}
                    sort={salesParams.sort}
                    dir={salesParams.dir}
                    basePath={basePath}
                    query={query}
                    defaultDir="desc"
                  />
                  <TH align="right">{ts('columns.bricks')}</TH>
                  <SortableTH
                    prefix={SALES}
                    column="avgRatePaise"
                    label={ts('columns.rate')}
                    sort={salesParams.sort}
                    dir={salesParams.dir}
                    basePath={basePath}
                    query={query}
                    align="right"
                    defaultDir="desc"
                  />
                  <SortableTH
                    prefix={SALES}
                    column="totalPaise"
                    label={ts('columns.total')}
                    sort={salesParams.sort}
                    dir={salesParams.dir}
                    basePath={basePath}
                    query={query}
                    align="right"
                    defaultDir="desc"
                  />
                  <SortableTH
                    prefix={SALES}
                    column="duePaise"
                    label={ts('columns.due')}
                    sort={salesParams.sort}
                    dir={salesParams.dir}
                    basePath={basePath}
                    query={query}
                    align="right"
                    defaultDir="desc"
                  />
                  <TH>{ts('columns.status')}</TH>
                </THead>
              }
            />
            <Pagination
              prefix={SALES}
              basePath={basePath}
              query={query}
              next={sales.next}
              prev={sales.prev}
              count={sales.rows.length}
            />
          </>
        )}
      </section>

      <section className="mt-8" aria-labelledby="payments-received">
        <div className="mb-3 flex flex-col gap-3 @xl:flex-row @xl:items-center @xl:justify-between">
          <h2 id="payments-received" className="text-base font-semibold">
            {t('detail.payments')}
          </h2>
          <SortSelect
            className="@3xl:hidden"
            prefix={PAY}
            sort={payParams.sort}
            dir={payParams.dir}
            options={[
              { sort: 'paidAt', dir: 'desc', label: t('detail.paySort.newest') },
              { sort: 'paidAt', dir: 'asc', label: t('detail.paySort.oldest') },
              { sort: 'amountPaise', dir: 'desc', label: t('detail.paySort.largest') },
            ]}
          />
        </div>
        {payments.rows.length === 0 ? (
          <p className="border-border text-foreground-muted rounded-lg border border-dashed p-6 text-center text-sm">
            {t('detail.paymentsEmpty')}
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-2 @3xl:hidden">
              {payments.rows.map((payment) => (
                <li
                  key={payment.id}
                  className="border-border bg-surface flex items-center justify-between gap-3 rounded-lg border p-4 text-sm"
                >
                  <div>
                    <p className="text-base font-semibold tabular-nums">
                      {money(payment.amountPaise)}
                    </p>
                    <p className="text-foreground-muted text-xs">
                      {formatDate(payment.paidAt, locale)} · {ts(`modes.${payment.mode}`)}
                    </p>
                  </div>
                  <Link
                    href={`/sales/${payment.saleId}`}
                    className="text-action inline-flex min-h-11 items-center gap-1 text-xs"
                  >
                    <ReceiptText aria-hidden className="size-3.5" />
                    {t('detail.againstSale', { number: formatSaleNumber(payment.saleNumber) })}
                  </Link>
                </li>
              ))}
            </ul>
            <Table caption={t('detail.payments')} className="hidden @3xl:block" minWidth="36rem">
              <THead>
                <SortableTH
                  prefix={PAY}
                  column="paidAt"
                  label={t('detail.payDate')}
                  sort={payParams.sort}
                  dir={payParams.dir}
                  basePath={basePath}
                  query={query}
                  defaultDir="desc"
                />
                <SortableTH
                  prefix={PAY}
                  column="amountPaise"
                  label={t('detail.payAmount')}
                  sort={payParams.sort}
                  dir={payParams.dir}
                  basePath={basePath}
                  query={query}
                  align="right"
                  defaultDir="desc"
                />
                <TH>{t('detail.payMode')}</TH>
                <TH>{t('detail.payBill')}</TH>
              </THead>
              <TBody>
                {payments.rows.map((payment) => (
                  <ClickableRow key={payment.id} href={`/sales/${payment.saleId}`}>
                    <TD muted className="whitespace-nowrap">
                      {formatDate(payment.paidAt, locale)}
                    </TD>
                    <TD align="right" className="font-medium">
                      {money(payment.amountPaise)}
                    </TD>
                    <TD muted>{ts(`modes.${payment.mode}`)}</TD>
                    <TD>
                      <Link href={`/sales/${payment.saleId}`} className="hover:text-action">
                        {formatSaleNumber(payment.saleNumber)}
                      </Link>
                    </TD>
                  </ClickableRow>
                ))}
              </TBody>
            </Table>
            <Pagination
              prefix={PAY}
              basePath={basePath}
              query={query}
              next={payments.next}
              prev={payments.prev}
              count={payments.rows.length}
            />
          </>
        )}
      </section>
    </DetailFrame>
  );
}
