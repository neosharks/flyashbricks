import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Boxes, Clock, IndianRupee, Plus, ReceiptIndianRupee, Tag, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterPills } from '@/components/ui/filter-pills';
import { Page } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { SortSelect } from '@/components/ui/sort-select';
import { StatCard } from '@/components/ui/stat-card';
import { TableSearch } from '@/components/ui/table-search';
import { NoResults, Pagination, SortableTH, TH, THead } from '@/components/ui/data-table';
import { AgeingBar } from '@/components/sales/ageing-bar';
import { DateRangeFilter } from '@/components/sales/date-range-filter';
import { ExportLink } from '@/components/sales/export-link';
import { MoneyColumnChart } from '@/components/sales/money-chart';
import { SalesList } from '@/components/sales/sales-table';
import { SalesActiveFilters } from '@/components/sales/active-filters';
import { SalesGroups } from '@/components/sales/sales-groups';
import { parseSalesFilters } from '@/features/sales/filters';
import { getOrgSummary } from '@/lib/org';
import {
  dailySales,
  groupSales,
  listSales,
  periodStats,
  receivablesAgeing,
  SALE_SORTS,
  salesFilterNames,
  summarizeSales,
} from '@/features/sales/queries';
import { SALE_GROUPS } from '@/features/sales/types';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { requirePermissionPage } from '@/lib/session';
import { parseTableParams } from '@/lib/table';
import { formatNumber, formatPercent } from '@/lib/utils';
import { DeliveryTruck } from '@/components/illustrations';

export const metadata: Metadata = { title: 'Sales' };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SalesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermissionPage('/sales', 'sales:read');
  const query = await searchParams;
  const { timezone } = await getOrgSummary(viewer.orgId);
  const params = parseTableParams(query, SALE_SORTS, { sort: 'date', dir: 'desc' });
  const filters = parseSalesFilters(query, timezone);
  const rawGroup = Array.isArray(query.group) ? query.group[0] : query.group;
  const group = SALE_GROUPS.find((candidate) => candidate === rawGroup) ?? null;

  const [t, locale, page, groups, names, summary, periods, ageing, daily] = await Promise.all([
    getTranslations('sales'),
    getLocale(),
    group ? null : listSales(viewer, params, filters, timezone),
    group ? groupSales(viewer, filters, params.q, timezone, group) : null,
    salesFilterNames(viewer, filters),
    summarizeSales(viewer, filters, params.q, timezone),
    periodStats(viewer, timezone),
    receivablesAgeing(viewer, timezone),
    // Twice the shown 30 days, so the chart can compare with the 30 before.
    dailySales(viewer, timezone, 60),
  ]);
  const canWrite = can(viewer, 'sales:write');
  const money = (paise: number) => formatMoney(paise, locale);
  const filtered =
    params.q !== '' ||
    filters.range !== null ||
    filters.status !== null ||
    filters.customerId !== null ||
    filters.productId !== null ||
    filters.rateBand !== null;
  const avgRate = summary.bricks > 0 ? Math.round(summary.subtotalPaise / summary.bricks) : 0;
  const dayLabel = new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const salesPoints = daily.map((point) => ({
    label: dayLabel.format(new Date(`${point.day}T00:00:00Z`)),
    paise: point.totalPaise,
    bricks: point.bricks,
    avgRatePaise: point.avgRatePaise,
  }));

  return (
    <Page size="wide">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <>
            {canWrite && (
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/sales/new">
                  <Plus aria-hidden />
                  {t('new')}
                </Link>
              </Button>
            )}
            <ExportLink href="/api/export/sales" query={query} label={t('exportCsv')} />
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <DateRangeFilter query={query} from={filters.from} to={filters.to} />
      </div>

      <section
        aria-label={t('summary.title')}
        className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5"
      >
        <StatCard
          label={t('summary.value')}
          value={money(summary.totalPaise)}
          icon={ReceiptIndianRupee}
          tone="action"
          hint={t('summary.count', { count: summary.count })}
        />
        <StatCard
          label={t('summary.bricks')}
          value={formatNumber(summary.bricks, locale)}
          icon={Boxes}
        />
        <StatCard
          label={t('summary.received')}
          value={money(summary.paidPaise)}
          icon={IndianRupee}
          tone="success"
          hint={
            summary.totalPaise > 0
              ? t('summary.receivedShare', {
                  percent: formatPercent(summary.paidPaise / summary.totalPaise, locale),
                })
              : undefined
          }
        />
        <StatCard
          label={t('summary.pending')}
          value={money(summary.duePaise)}
          icon={Wallet}
          tone={summary.duePaise > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label={t('summary.avgRate')}
          value={summary.bricks > 0 ? money(avgRate) : '—'}
          icon={Tag}
          className="col-span-2 lg:col-span-1"
          hint={
            summary.count === 0
              ? undefined
              : summary.minRatePaise === summary.maxRatePaise
                ? t('summary.rateOne', { rate: money(summary.minRatePaise) })
                : t('summary.rateRange', {
                    min: money(summary.minRatePaise),
                    max: money(summary.maxRatePaise),
                  })
          }
        />
      </section>

      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <TableSearch placeholder={t('searchPlaceholder')} />
        <FilterPills
          label={t('statusFilter.label')}
          param="status"
          basePath="/sales"
          query={query}
          options={[
            { value: null, label: t('statusFilter.all') },
            { value: 'due', label: t('statusFilter.due') },
            { value: 'unpaid', label: t('statusFilter.unpaid') },
            { value: 'partial', label: t('statusFilter.partial') },
            { value: 'paid', label: t('statusFilter.paid') },
            { value: 'voided', label: t('statusFilter.voided') },
          ]}
        />
      </div>

      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterPills
          label={t('group.label')}
          param="group"
          basePath="/sales"
          query={query}
          options={[
            { value: null, label: t('group.none') },
            ...SALE_GROUPS.map((value) => ({ value, label: t(`group.${value}`) })),
          ]}
        />
        {!group && (
          <SortSelect
            className="md:hidden"
            sort={params.sort}
            dir={params.dir}
            options={[
              { sort: 'date', dir: 'desc', label: t('sort.newest') },
              { sort: 'date', dir: 'asc', label: t('sort.oldest') },
              { sort: 'totalPaise', dir: 'desc', label: t('sort.highestTotal') },
              { sort: 'totalPaise', dir: 'asc', label: t('sort.lowestTotal') },
              { sort: 'duePaise', dir: 'desc', label: t('sort.mostDue') },
              { sort: 'customerName', dir: 'asc', label: t('sort.customerAz') },
              { sort: 'bricks', dir: 'desc', label: t('sort.mostBricks') },
              { sort: 'avgRatePaise', dir: 'desc', label: t('sort.highestRate') },
              { sort: 'avgRatePaise', dir: 'asc', label: t('sort.lowestRate') },
            ]}
          />
        )}
      </div>

      <div className="mb-3">
        <SalesActiveFilters filters={filters} names={names} query={query} />
      </div>

      {groups ? (
        groups.length === 0 ? (
          <NoResults />
        ) : (
          <SalesGroups by={group ?? 'day'} rows={groups} query={query} />
        )
      ) : !page || page.rows.length === 0 ? (
        filtered ? (
          <NoResults />
        ) : (
          <EmptyState
            illustration={<DeliveryTruck loaded className="h-full w-auto" />}
            icon={ReceiptIndianRupee}
            title={t('emptyTitle')}
            description={t('emptyBody')}
            action={
              canWrite && (
                <Button asChild size="lg">
                  <Link href="/sales/new">
                    <Plus aria-hidden />
                    {t('new')}
                  </Link>
                </Button>
              )
            }
          />
        )
      ) : (
        <>
          <SalesList
            rows={page.rows}
            caption={t('title')}
            header={
              <THead>
                <TH>{t('columns.number')}</TH>
                <SortableTH
                  column="date"
                  label={t('columns.date')}
                  sort={params.sort}
                  dir={params.dir}
                  basePath="/sales"
                  query={query}
                  defaultDir="desc"
                />
                <SortableTH
                  column="customerName"
                  label={t('columns.customer')}
                  sort={params.sort}
                  dir={params.dir}
                  basePath="/sales"
                  query={query}
                />
                <SortableTH
                  column="bricks"
                  label={t('columns.bricks')}
                  sort={params.sort}
                  dir={params.dir}
                  basePath="/sales"
                  query={query}
                  align="right"
                  defaultDir="desc"
                />
                <SortableTH
                  column="avgRatePaise"
                  label={t('columns.rate')}
                  sort={params.sort}
                  dir={params.dir}
                  basePath="/sales"
                  query={query}
                  align="right"
                  defaultDir="desc"
                />
                <SortableTH
                  column="totalPaise"
                  label={t('columns.total')}
                  sort={params.sort}
                  dir={params.dir}
                  basePath="/sales"
                  query={query}
                  align="right"
                  defaultDir="desc"
                />
                <SortableTH
                  column="duePaise"
                  label={t('columns.due')}
                  sort={params.sort}
                  dir={params.dir}
                  basePath="/sales"
                  query={query}
                  align="right"
                  defaultDir="desc"
                />
                <TH>{t('columns.status')}</TH>
              </THead>
            }
          />
          <Pagination
            basePath="/sales"
            query={query}
            next={page.next}
            prev={page.prev}
            count={page.rows.length}
          />
        </>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('chart.title')}</CardTitle>
          </CardHeader>
          <CardBody>
            <MoneyColumnChart
              title={t('chart.title')}
              seriesLabel={t('chart.value')}
              emptyLabel={t('chart.empty')}
              data={salesPoints.slice(-30)}
              history={salesPoints}
            />
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock aria-hidden className="text-foreground-muted size-4" />
                {t('ageing.title')}
              </CardTitle>
              <p className="text-foreground-muted text-xs">{t('ageing.description')}</p>
            </CardHeader>
            <CardBody>
              <AgeingBar rows={ageing} />
            </CardBody>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            {(['week', 'month'] as const).map((period) => (
              <StatCard
                key={period}
                label={t(`period.${period}`)}
                value={money(periods[period].totalPaise)}
                hint={t('period.detail', {
                  bricks: formatNumber(periods[period].bricks, locale),
                  count: periods[period].count,
                })}
              />
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
}
