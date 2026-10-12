import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronRight, IndianRupee, UserPlus, Users, Wallet, X } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterPills } from '@/components/ui/filter-pills';
import { Page } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { SortSelect } from '@/components/ui/sort-select';
import { StatCard } from '@/components/ui/stat-card';
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
  TR,
} from '@/components/ui/data-table';
import { CustomerDialogButton } from '@/components/customers/customer-dialog';
import { CustomerGroups } from '@/components/customers/customer-groups';
import { ExportLink } from '@/components/sales/export-link';
import {
  CUSTOMER_SORTS,
  customerStats,
  groupCustomers,
  listCustomers,
  parseCustomerFilters,
} from '@/features/customers/queries';
import { CUSTOMER_GROUPS } from '@/features/customers/types';
import { tableHref } from '@/lib/table-href';
import { getOrgSummary } from '@/lib/org';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { formatPhone } from '@/lib/phone';
import { requirePermissionPage } from '@/lib/session';
import { parseTableParams } from '@/lib/table';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { DeliveryTruck } from '@/components/illustrations';

export const metadata: Metadata = { title: 'Customers' };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermissionPage('/customers', 'sales:read');
  const query = await searchParams;
  const filters = parseCustomerFilters(query);
  const dues = filters.dues;
  const params = parseTableParams(query, CUSTOMER_SORTS, {
    sort: dues ? 'duePaise' : 'name',
    dir: dues ? 'desc' : 'asc',
  });
  const rawGroup = Array.isArray(query.group) ? query.group[0] : query.group;
  const group = CUSTOMER_GROUPS.find((candidate) => candidate === rawGroup) ?? null;
  const org = await getOrgSummary(viewer.orgId);

  const [t, locale, page, groups, stats] = await Promise.all([
    getTranslations('customers'),
    getLocale(),
    group ? null : listCustomers(viewer, { ...params, ...filters }, org.timezone),
    group ? groupCustomers(viewer, filters, params.q, org.timezone, group) : null,
    customerStats(viewer),
  ]);
  const canWrite = can(viewer, 'sales:write');
  const filtered =
    params.q !== '' ||
    dues ||
    filters.duesBracket !== null ||
    filters.recency !== null ||
    filters.city !== null;
  const chips = [
    ...(filters.city
      ? [{ key: 'city', label: filters.city === '—' ? t('group.noCity') : filters.city }]
      : []),
    ...(filters.duesBracket ? [{ key: 'bracket', label: t(`dues.${filters.duesBracket}`) }] : []),
    ...(filters.recency ? [{ key: 'recency', label: t(`recency.${filters.recency}`) }] : []),
  ];
  const money = (paise: number) => formatMoney(paise, locale);

  return (
    <Page size="wide">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <>
            {canWrite && (
              <CustomerDialogButton defaultStateCode={org.stateCode}>
                <UserPlus aria-hidden />
                {t('add')}
              </CustomerDialogButton>
            )}
            <ExportLink href="/api/export/customers" query={query} label={t('exportCsv')} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label={t('stats.receivable')}
          value={money(stats.receivablePaise)}
          icon={IndianRupee}
          tone={stats.receivablePaise > 0 ? 'danger' : 'success'}
          className="col-span-2 lg:col-span-1"
        />
        <StatCard
          label={t('stats.withDues')}
          value={formatNumber(stats.withDues, locale)}
          icon={Wallet}
          tone={stats.withDues > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label={t('stats.customers')}
          value={formatNumber(stats.customers, locale)}
          icon={Users}
        />
      </div>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TableSearch placeholder={t('searchPlaceholder')} />
        <FilterPills
          label={t('filters.label')}
          param="dues"
          basePath="/customers"
          query={query}
          options={[
            { value: null, label: t('filters.all') },
            { value: '1', label: t('filters.withDues'), count: stats.withDues },
          ]}
        />
      </div>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills
          label={t('group.label')}
          param="group"
          basePath="/customers"
          query={query}
          options={[
            { value: null, label: t('group.none') },
            ...CUSTOMER_GROUPS.map((value) => ({ value, label: t(`group.${value}`) })),
          ]}
        />
        {!group && (
          <SortSelect
            className="md:hidden"
            sort={params.sort}
            dir={params.dir}
            options={[
              { sort: 'name', dir: 'asc', label: t('sort.nameAz') },
              { sort: 'duePaise', dir: 'desc', label: t('sort.mostDue') },
              { sort: 'lastSaleAt', dir: 'desc', label: t('sort.recentBuyer') },
              { sort: 'bricksBought', dir: 'desc', label: t('sort.mostBricks') },
              { sort: 'createdAt', dir: 'desc', label: t('sort.newest') },
            ]}
          />
        )}
      </div>

      {chips.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.key}>
              <Link
                href={tableHref('/customers', query, { [chip.key]: null })}
                className="bg-action-subtle text-action inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium sm:min-h-9"
              >
                {chip.label}
                <X aria-hidden className="size-3.5" />
                <span className="sr-only">{t('filtersActive.clear')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {groups ? (
        groups.length === 0 ? (
          <NoResults />
        ) : (
          <CustomerGroups by={group ?? 'city'} rows={groups} query={query} />
        )
      ) : !page || page.rows.length === 0 ? (
        filtered ? (
          <NoResults />
        ) : (
          <EmptyState
            illustration={<DeliveryTruck loaded className="h-full w-auto" />}
            icon={Users}
            title={t('emptyTitle')}
            description={t('emptyBody')}
          />
        )
      ) : (
        <>
          {/* Phones: one tappable card per customer, the amount due big. */}
          <ul className="flex flex-col gap-2 md:hidden">
            {page.rows.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/customers/${customer.id}`}
                  className="border-border bg-surface active:bg-surface-muted flex items-center gap-3 rounded-lg border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{customer.name}</p>
                    <p className="text-foreground-muted truncate text-sm tabular-nums">
                      {formatPhone(customer.phones[0] ?? '')}
                      {customer.city ? ` · ${customer.city}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'text-lg font-semibold tabular-nums',
                        customer.duePaise > 0 ? 'text-danger' : 'text-success',
                      )}
                    >
                      {money(customer.duePaise)}
                    </p>
                    <p className="text-foreground-muted text-xs">
                      {customer.duePaise > 0 ? t('detail.dueTone') : t('detail.settled')}
                    </p>
                  </div>
                  <ChevronRight aria-hidden className="text-foreground-subtle size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden md:block">
            <Table caption={t('title')} minWidth="54rem">
              <THead>
                <SortableTH
                  column="name"
                  label={t('columns.name')}
                  sort={params.sort}
                  dir={params.dir}
                  basePath="/customers"
                  query={query}
                />
                <TH>{t('columns.phone')}</TH>
                <TH>{t('columns.city')}</TH>
                <TH align="right">{t('columns.billed')}</TH>
                <SortableTH
                  column="bricksBought"
                  label={t('columns.bricks')}
                  sort={params.sort}
                  dir={params.dir}
                  basePath="/customers"
                  query={query}
                  align="right"
                  defaultDir="desc"
                />
                <SortableTH
                  column="duePaise"
                  label={t('columns.due')}
                  sort={params.sort}
                  dir={params.dir}
                  basePath="/customers"
                  query={query}
                  align="right"
                  defaultDir="desc"
                />
                <SortableTH
                  column="lastSaleAt"
                  label={t('columns.lastSale')}
                  sort={params.sort}
                  dir={params.dir}
                  basePath="/customers"
                  query={query}
                  defaultDir="desc"
                />
              </THead>
              <TBody>
                {page.rows.map((customer) => (
                  <TR key={customer.id}>
                    <TD>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="hover:text-action font-medium"
                      >
                        {customer.name}
                      </Link>
                    </TD>
                    <TD muted className="whitespace-nowrap tabular-nums">
                      {formatPhone(customer.phones[0] ?? '')}
                    </TD>
                    <TD muted>{customer.city ?? '—'}</TD>
                    <TD align="right">{money(customer.billedPaise)}</TD>
                    <TD align="right" muted>
                      {formatNumber(customer.bricksBought, locale)}
                    </TD>
                    <TD
                      align="right"
                      className={cn('font-medium', customer.duePaise > 0 && 'text-danger')}
                    >
                      {money(customer.duePaise)}
                    </TD>
                    <TD muted className="whitespace-nowrap">
                      {customer.lastSaleAt ? formatDate(customer.lastSaleAt, locale) : '—'}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <Pagination
            basePath="/customers"
            query={query}
            next={page.next}
            prev={page.prev}
            count={page.rows.length}
          />
        </>
      )}
    </Page>
  );
}
