import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  Download,
  Gift,
  HandCoins,
  IndianRupee,
  MinusCircle,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterPills } from '@/components/ui/filter-pills';
import { GroupedTable, type GroupRow } from '@/components/ui/grouped-table';
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
import { PaymentsChart } from '@/components/staff/payments-chart';
import { PaymentsPeriod } from '@/components/staff/payments-period';
import { StaffTabs } from '@/components/staff/staff-tabs';
import {
  bucketFacts,
  bucketUnit,
  groupFacts,
  listPayments,
  parsePaymentsFilters,
  PAYMENT_GROUPS,
  PAYMENT_SORTS,
  paymentFacts,
  previousRange,
  staffBriefs,
  summarizeFacts,
  type PaymentGroupRow,
} from '@/features/staff/payments-report';
import { pickText } from '@/lib/bilingual';
import { todayKey } from '@/lib/dates';
import { formatMoney, intlLocale } from '@/lib/money';
import { getOrgTimezone } from '@/lib/org';
import { requirePermissionPage } from '@/lib/session';
import { parseTableParams } from '@/lib/table';
import { tableHref } from '@/lib/table-href';
import { cn, formatDate, formatNumber, formatPercent } from '@/lib/utils';
import {
  PAYMENT_MODES,
  STAFF_PAYMENT_TYPES,
  STAFF_ROLES,
  type PaymentMode,
  type StaffPaymentType,
  type StaffRole,
} from '@/models/constants';

export const metadata: Metadata = { title: 'Money paid' };

type SearchParams = Record<string, string | string[] | undefined>;

const BASE = '/staff/payments';

export default async function StaffPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermissionPage(BASE, 'staff:read');
  const query = await searchParams;
  const timeZone = await getOrgTimezone(viewer.orgId);
  const today = todayKey(timeZone);
  const filters = parsePaymentsFilters(query, timeZone);
  const params = parseTableParams(query, PAYMENT_SORTS, { sort: 'paidOn', dir: 'desc' });
  const rawGroup = Array.isArray(query.group) ? query.group[0] : query.group;
  const group = PAYMENT_GROUPS.find((candidate) => candidate === rawGroup) ?? null;
  const previous = previousRange(filters.from, filters.to);
  const unit = bucketUnit(filters.from, filters.to);

  const [t, locale, facts, previousFacts, page] = await Promise.all([
    getTranslations('staff'),
    getLocale(),
    paymentFacts(viewer, filters, params.q, filters, timeZone),
    paymentFacts(viewer, filters, params.q, previous, timeZone),
    group ? null : listPayments(viewer, filters, params, timeZone),
  ]);

  const summary = summarizeFacts(facts);
  const before = summarizeFacts(previousFacts);
  const briefs = await staffBriefs(viewer, [
    ...facts.map((fact) => fact.staffId),
    ...(filters.staffId ? [filters.staffId] : []),
  ]);
  const roleOf = (id: string): StaffRole | null => briefs.get(id)?.role ?? null;
  const nameOf = (id: string) => {
    const brief = briefs.get(id);
    return brief ? pickText(brief.name, brief.nameHi, locale) : t('payments.groups.unknownPerson');
  };
  const money = (paise: number) => formatMoney(paise, locale);
  const short = new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const monthName = new Intl.DateTimeFormat(intlLocale(locale), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const change = () => {
    if (before.paidOut === 0) return summary.paidOut > 0 ? t('payments.tiles.noBefore') : undefined;
    const ratio = (summary.paidOut - before.paidOut) / before.paidOut;
    if (Math.abs(ratio) < 0.005) return t('payments.tiles.same');
    return t('payments.tiles.vsBefore', {
      change: `${ratio > 0 ? '▲' : '▼'} ${formatPercent(Math.abs(ratio), locale)}`,
    });
  };

  const groupLabel = (row: PaymentGroupRow): string => {
    switch (group) {
      case 'person':
        return nameOf(row.key);
      case 'role':
        return t(`roles.${row.key as StaffRole}`);
      case 'month':
        return monthName.format(new Date(`${row.key}-01T00:00:00Z`));
      case 'week':
        return t('payments.groups.weekOf', {
          date: short.format(new Date(`${row.key}T00:00:00Z`)),
        });
      case 'type':
        return t(`payment.types.${row.key as StaffPaymentType}`);
      case 'mode':
        return t(`payment.modes.${row.key as PaymentMode}`);
      case null:
        return row.key;
    }
  };

  /** Each group opens the list narrowed to it. */
  const groupHref = (row: PaymentGroupRow): string | undefined => {
    const without = { ...query, group: undefined };
    switch (group) {
      case 'person':
        return tableHref(BASE, without, { staff: row.key });
      case 'role':
        return tableHref(BASE, without, { role: row.key });
      case 'type':
        return tableHref(BASE, without, { type: row.key });
      case 'mode':
        return tableHref(BASE, without, { mode: row.key });
      case 'month': {
        const [year, month] = row.key.split('-').map(Number);
        const end = new Date(Date.UTC(year ?? 1970, month ?? 1, 0)).toISOString().slice(0, 10);
        return tableHref(BASE, without, {
          period: 'custom',
          from: `${row.key}-01`,
          to: end > today ? today : end,
        });
      }
      case 'week': {
        const end = new Date(new Date(`${row.key}T00:00:00Z`).getTime() + 6 * 86_400_000)
          .toISOString()
          .slice(0, 10);
        return tableHref(BASE, without, {
          period: 'custom',
          from: row.key,
          to: end > today ? today : end,
        });
      }
      case null:
        return undefined;
    }
  };

  const toGroupRows = (rows: PaymentGroupRow[]): GroupRow[] =>
    rows.map((row) => {
      const href = groupHref(row);
      return {
        key: row.key,
        label: groupLabel(row),
        ...(group === 'person' && roleOf(row.key)
          ? { sublabel: t(`roles.${roleOf(row.key) ?? 'other'}`) }
          : {}),
        ...(href ? { href } : {}),
        values: {
          net: row.net,
          payments: row.payments,
          wage: row.wage,
          advance: row.advance,
          bonus: row.bonus,
          deduction: row.deduction,
        },
      };
    });

  const groupColumns = [
    { key: 'net', label: t('payments.groups.net'), format: 'money' as const, bar: true },
    { key: 'payments', label: t('payments.groups.payments'), format: 'number' as const },
    { key: 'wage', label: t('payments.tiles.wages'), format: 'money' as const },
    { key: 'advance', label: t('payments.tiles.advances'), format: 'money' as const },
    { key: 'bonus', label: t('payments.tiles.bonuses'), format: 'money' as const },
    { key: 'deduction', label: t('payments.tiles.deductions'), format: 'money' as const },
  ];

  const topPaid = groupFacts(facts, 'person', roleOf).slice(0, 5);
  const groups = group ? groupFacts(facts, group, roleOf) : null;
  const personBrief = filters.staffId ? briefs.get(filters.staffId) : undefined;
  const filtered =
    params.q !== '' ||
    filters.staffId !== null ||
    filters.role !== null ||
    filters.type !== null ||
    filters.mode !== null;
  const exportHref = tableHref(
    '/api/export/staff-payments',
    { ...query, period: 'custom', from: filters.from, to: filters.to },
    {},
  );

  return (
    <Page>
      <PageHeader
        title={t('payments.title')}
        description={t('payments.description')}
        actions={
          summary.payments > 0 && (
            <Button asChild variant="outline">
              <a href={exportHref} download>
                <Download aria-hidden />
                {t('payments.export')}
              </a>
            </Button>
          )
        }
      />
      <StaffTabs current="payments" />

      <div className="mb-4 flex flex-col gap-3">
        <PaymentsPeriod preset={filters.preset} from={filters.from} to={filters.to} today={today} />
        {filters.staffId && (
          <div>
            <Link
              href={tableHref(BASE, query, { staff: null })}
              className="border-action bg-action-subtle text-action inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium sm:min-h-9"
            >
              <Avatar
                name={personBrief?.name ?? '?'}
                imageId={personBrief?.photoAssetId ?? null}
                size="sm"
                className="size-6"
              />
              {nameOf(filters.staffId)}
              <X aria-hidden className="size-4" />
              <span className="sr-only">{t('payments.filters.clearPerson')}</span>
            </Link>
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label={t('payments.tiles.paidOut')}
          value={money(summary.paidOut)}
          icon={Wallet}
          tone="action"
          hint={change() ?? t('payments.tiles.paidOutHint')}
          className="col-span-2 lg:col-span-1"
        />
        <StatCard
          label={t('payments.tiles.wages')}
          value={money(summary.wage)}
          icon={IndianRupee}
        />
        <StatCard
          label={t('payments.tiles.advances')}
          value={money(summary.advance)}
          icon={HandCoins}
        />
        <StatCard
          label={t('payments.tiles.bonuses')}
          value={money(summary.bonus)}
          icon={Gift}
          tone="success"
        />
        <StatCard
          label={t('payments.tiles.deductions')}
          value={money(summary.deduction)}
          icon={MinusCircle}
          tone={summary.deduction > 0 ? 'danger' : 'neutral'}
        />
        <StatCard
          label={t('payments.tiles.people')}
          value={formatNumber(summary.people, locale)}
          icon={Users}
          hint={`${t('payments.tiles.average')}: ${money(summary.averagePerPerson)}`}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>
              {unit === 'day' ? t('payments.chart.title') : t('payments.chart.titleMonthly')}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <PaymentsChart
              title={t('payments.chart.title')}
              buckets={bucketFacts(facts, filters.from, filters.to, unit)}
              unit={unit}
              previousTotal={before.paidOut}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('payments.top.title')}</CardTitle>
          </CardHeader>
          <CardBody>
            {topPaid.length === 0 ? (
              <p className="text-foreground-muted text-sm">{t('payments.top.empty')}</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {topPaid.map((row) => {
                  const brief = briefs.get(row.key);
                  const max = topPaid[0]?.net ?? 1;
                  return (
                    <li key={row.key}>
                      <Link
                        href={tableHref(BASE, query, { staff: row.key, group: null })}
                        className="group flex items-center gap-3"
                      >
                        <Avatar
                          name={brief?.name ?? '?'}
                          imageId={brief?.photoAssetId ?? null}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex justify-between gap-2 text-sm">
                            <span className="group-hover:text-action truncate font-medium">
                              {nameOf(row.key)}
                            </span>
                            <span className="tabular-nums">{money(row.net)}</span>
                          </span>
                          <span
                            className="bg-surface-muted mt-1 block h-1.5 overflow-hidden rounded-full"
                            aria-hidden
                          >
                            <span
                              className="bg-chart-1 block h-full rounded-full"
                              style={{
                                width: `${max > 0 ? Math.max(4, (row.net / max) * 100) : 0}%`,
                              }}
                            />
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mb-3 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TableSearch placeholder={t('payments.searchPlaceholder')} />
          {!group && (
            <SortSelect
              className="md:hidden"
              sort={params.sort}
              dir={params.dir}
              options={[
                { sort: 'paidOn', dir: 'desc', label: t('payments.sort.newest') },
                { sort: 'paidOn', dir: 'asc', label: t('payments.sort.oldest') },
                { sort: 'amountPaise', dir: 'desc', label: t('payments.sort.highest') },
                { sort: 'amountPaise', dir: 'asc', label: t('payments.sort.lowest') },
                { sort: 'person', dir: 'asc', label: t('payments.sort.personAsc') },
              ]}
            />
          )}
        </div>
        <FilterPills
          label={t('payments.filters.type')}
          param="type"
          basePath={BASE}
          query={query}
          options={[
            { value: null, label: t('payments.filters.allTypes') },
            ...STAFF_PAYMENT_TYPES.map((type) => ({
              value: type,
              label: t(`payment.types.${type}`),
            })),
          ]}
        />
        <FilterPills
          label={t('payments.filters.mode')}
          param="mode"
          basePath={BASE}
          query={query}
          options={[
            { value: null, label: t('payments.filters.allModes') },
            ...PAYMENT_MODES.map((mode) => ({ value: mode, label: t(`payment.modes.${mode}`) })),
          ]}
        />
        <FilterPills
          label={t('payments.filters.role')}
          param="role"
          basePath={BASE}
          query={query}
          options={[
            { value: null, label: t('payments.filters.allRoles') },
            ...STAFF_ROLES.map((role) => ({ value: role, label: t(`roles.${role}`) })),
          ]}
        />
        <FilterPills
          label={t('payments.filters.groupLabel')}
          param="group"
          basePath={BASE}
          query={query}
          options={[
            { value: null, label: t('payments.filters.noGroup') },
            { value: 'person', label: t('payments.filters.person') },
            { value: 'role', label: t('payments.filters.role_') },
            { value: 'month', label: t('payments.filters.month') },
            { value: 'week', label: t('payments.filters.week') },
            { value: 'type', label: t('payments.filters.type_') },
            { value: 'mode', label: t('payments.filters.mode_') },
          ]}
        />
      </div>

      {groups ? (
        groups.length === 0 ? (
          <NoResults />
        ) : (
          <GroupedTable
            caption={t('payments.title')}
            groupLabel={t(
              `payments.filters.${group === 'role' ? 'role_' : group === 'type' ? 'type_' : group === 'mode' ? 'mode_' : (group ?? 'person')}`,
            )}
            columns={groupColumns}
            rows={toGroupRows(groups)}
            totals={{
              net: summary.paidOut - summary.deduction,
              payments: summary.payments,
              wage: summary.wage,
              advance: summary.advance,
              bonus: summary.bonus,
              deduction: summary.deduction,
            }}
          />
        )
      ) : page?.rows.length === 0 ? (
        filtered ? (
          <NoResults />
        ) : (
          <EmptyState
            icon={Wallet}
            title={t('payments.emptyTitle')}
            description={t('payments.emptyBody')}
          />
        )
      ) : page ? (
        <>
          <ul className="flex flex-col gap-2 md:hidden">
            {page.rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/staff/${row.staffId}`}
                  className={cn(
                    'border-border bg-surface active:bg-surface-muted flex items-center gap-3 rounded-lg border p-3',
                    row.voided && 'opacity-60',
                  )}
                >
                  <Avatar
                    name={row.staff?.name ?? '?'}
                    imageId={row.staff?.photoAssetId ?? null}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{nameOf(row.staffId)}</p>
                    <p className="text-foreground-muted text-xs">
                      {formatDate(`${row.paidOn}T00:00:00Z`, locale, 'UTC')} ·{' '}
                      {t(`payment.types.${row.type}`)} · {t(`payment.modes.${row.mode}`)}
                    </p>
                    {row.voided && (
                      <p className="text-foreground-muted text-xs">{t('payments.cancelled')}</p>
                    )}
                  </div>
                  <p
                    className={cn(
                      'text-lg font-semibold tabular-nums',
                      row.voided && 'line-through',
                      !row.voided && row.type === 'bonus' && 'text-success',
                      !row.voided && row.type === 'deduction' && 'text-danger',
                    )}
                  >
                    {row.type === 'deduction' ? '−' : ''}
                    {money(row.amountPaise)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <Table caption={t('payments.title')} minWidth="50rem" className="hidden md:block">
            <THead>
              <SortableTH
                column="paidOn"
                label={t('payments.columns.date')}
                sort={params.sort}
                dir={params.dir}
                basePath={BASE}
                query={query}
                defaultDir="desc"
              />
              <SortableTH
                column="person"
                label={t('payments.columns.person')}
                sort={params.sort}
                dir={params.dir}
                basePath={BASE}
                query={query}
              />
              <TH>{t('payments.columns.type')}</TH>
              <SortableTH
                column="amountPaise"
                label={t('payments.columns.amount')}
                sort={params.sort}
                dir={params.dir}
                basePath={BASE}
                query={query}
                align="right"
                defaultDir="desc"
              />
              <TH>{t('payments.columns.mode')}</TH>
              <TH>{t('payments.columns.by')}</TH>
            </THead>
            <TBody>
              {page.rows.map((row) => (
                <TR key={row.id} className={cn(row.voided && 'text-foreground-subtle')}>
                  <TD muted className="whitespace-nowrap">
                    {formatDate(`${row.paidOn}T00:00:00Z`, locale, 'UTC')}
                  </TD>
                  <TD>
                    <Link
                      href={`/staff/${row.staffId}`}
                      className="hover:text-action flex items-center gap-2 font-medium"
                    >
                      <Avatar
                        name={row.staff?.name ?? '?'}
                        imageId={row.staff?.photoAssetId ?? null}
                        size="sm"
                      />
                      {nameOf(row.staffId)}
                    </Link>
                  </TD>
                  <TD>
                    <span className={cn(row.voided && 'line-through')}>
                      {t(`payment.types.${row.type}`)}
                    </span>
                    {row.voided && (
                      <span className="block text-xs">
                        {t('payments.cancelled')}
                        {row.voidReason ? `: ${row.voidReason}` : ''}
                      </span>
                    )}
                    {row.note && (
                      <span className="text-foreground-muted block text-xs">{row.note}</span>
                    )}
                  </TD>
                  <TD
                    align="right"
                    className={cn(
                      'font-medium',
                      row.voided && 'line-through',
                      !row.voided && row.type === 'bonus' && 'text-success',
                      !row.voided && row.type === 'deduction' && 'text-danger',
                    )}
                  >
                    {row.type === 'deduction' ? '−' : ''}
                    {money(row.amountPaise)}
                  </TD>
                  <TD muted>{t(`payment.modes.${row.mode}`)}</TD>
                  <TD muted>{row.recordedByName}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination
            basePath={BASE}
            query={query}
            next={page.next}
            prev={page.prev}
            count={page.rows.length}
          />
        </>
      ) : null}
    </Page>
  );
}
