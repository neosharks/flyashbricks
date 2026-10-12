import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { CalendarCheck, ChevronRight, HandCoins, HardHat, Wallet } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterPills } from '@/components/ui/filter-pills';
import { GroupedTable } from '@/components/ui/grouped-table';
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
import { ROLE_ICONS } from '@/components/staff/role-icon';
import { StaffDialog } from '@/components/staff/staff-dialog';
import { StaffTabs } from '@/components/staff/staff-tabs';
import { StatusChip } from '@/components/staff/status-chip';
import {
  groupStaff,
  linkableLogins,
  listStaff,
  parseStaffFilters,
  staffStats,
} from '@/features/staff/queries';
import { STAFF_GROUPS, STAFF_SORTS, type StaffListRow } from '@/features/staff/types';
import { pickText } from '@/lib/bilingual';
import { todayKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { getOrgTimezone } from '@/lib/org';
import { can } from '@/lib/permissions';
import { formatPhone } from '@/lib/phone';
import { requirePermissionPage } from '@/lib/session';
import { parseTableParams } from '@/lib/table';
import { cn, formatNumber } from '@/lib/utils';
import { STAFF_ROLES } from '@/models/constants';

export const metadata: Metadata = { title: 'Staff' };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function StaffPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermissionPage('/staff', 'staff:read');
  const query = await searchParams;
  const filters = parseStaffFilters(query);
  const params = parseTableParams(query, STAFF_SORTS, { sort: 'name', dir: 'asc' });
  const rawGroup = Array.isArray(query.group) ? query.group[0] : query.group;
  const group = STAFF_GROUPS.find((candidate) => candidate === rawGroup) ?? null;
  const timeZone = await getOrgTimezone(viewer.orgId);
  const canWrite = can(viewer, 'staff:write');

  const [t, locale, page, groups, stats, logins] = await Promise.all([
    getTranslations('staff'),
    getLocale(),
    group ? null : listStaff(viewer, { ...params, ...filters }, timeZone),
    group ? groupStaff(viewer, filters, params.q, group, timeZone) : null,
    staffStats(viewer, timeZone),
    canWrite ? linkableLogins(viewer, null) : Promise.resolve([]),
  ]);
  const money = (paise: number) => formatMoney(paise, locale);
  const owedLabel = (row: StaffListRow) =>
    row.balancePaise >= 0
      ? t('owed', { amount: money(row.balancePaise) })
      : t('paidAhead', { amount: money(-row.balancePaise) });
  const filtered = params.q !== '' || filters.role !== null || filters.status !== 'active';

  return (
    <Page>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={canWrite && <StaffDialog logins={logins} today={todayKey(timeZone)} />}
      />
      <StaffTabs current="people" />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t('stats.active')}
          value={formatNumber(stats.active, locale)}
          icon={HardHat}
          tone="action"
        />
        <StatCard
          label={t('stats.presentToday')}
          value={formatNumber(stats.presentToday, locale)}
          icon={CalendarCheck}
          tone="success"
          hint={`${stats.presentToday} / ${stats.active}`}
        />
        <StatCard
          label={t('stats.wagesDue')}
          value={money(stats.wagesDuePaise)}
          icon={Wallet}
          tone={stats.wagesDuePaise > 0 ? 'danger' : 'neutral'}
          hint={t('stats.wagesDueHint')}
        />
        <StatCard
          label={t('stats.advances')}
          value={money(stats.advancesThisMonthPaise)}
          icon={HandCoins}
        />
      </div>

      <div className="mb-3 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TableSearch placeholder={t('searchPlaceholder')} />
          {!group && (
            <SortSelect
              className="md:hidden"
              sort={params.sort}
              dir={params.dir}
              options={[
                { sort: 'name', dir: 'asc', label: t('sort.nameAsc') },
                { sort: 'name', dir: 'desc', label: t('sort.nameDesc') },
                { sort: 'role', dir: 'asc', label: t('sort.role') },
                { sort: 'createdAt', dir: 'desc', label: t('sort.newest') },
                { sort: 'createdAt', dir: 'asc', label: t('sort.oldest') },
              ]}
            />
          )}
        </div>
        <FilterPills
          label={t('filters.statusLabel')}
          param="status"
          basePath="/staff"
          query={query}
          options={[
            { value: null, label: t('filters.active') },
            { value: 'left', label: t('filters.left') },
            { value: 'everyone', label: t('filters.all') },
          ]}
        />
        <FilterPills
          label={t('filters.roleLabel')}
          param="role"
          basePath="/staff"
          query={query}
          options={[
            { value: null, label: t('filters.allRoles') },
            ...STAFF_ROLES.map((role) => ({ value: role, label: t(`roles.${role}`) })),
          ]}
        />
        <FilterPills
          label={t('filters.groupLabel')}
          param="group"
          basePath="/staff"
          query={query}
          options={[
            { value: null, label: t('filters.noGroup') },
            { value: 'role', label: t('filters.byRole') },
            { value: 'wageType', label: t('filters.byWageType') },
          ]}
        />
      </div>

      {groups ? (
        <GroupedTable
          caption={t('title')}
          groupLabel={group === 'role' ? t('filters.byRole') : t('filters.byWageType')}
          columns={[
            { key: 'people', label: t('columns.people'), format: 'number', bar: true },
            { key: 'presentToday', label: t('columns.presentToday'), format: 'number' },
            { key: 'balancePaise', label: t('columns.due'), format: 'money' },
            { key: 'advancesPaise', label: t('columns.advances'), format: 'money' },
          ]}
          rows={groups.map((row) => ({
            key: row.key,
            label:
              group === 'role'
                ? t(`roles.${row.key as (typeof STAFF_ROLES)[number]}`)
                : t(`wageTypes.${row.key as 'daily'}`),
            ...(group === 'role' ? { href: `/staff?role=${row.key}` } : {}),
            values: {
              people: row.people,
              presentToday: row.presentToday,
              balancePaise: row.balancePaise,
              advancesPaise: row.advancesPaise,
            },
          }))}
          totals={{
            people: groups.reduce((sum, row) => sum + row.people, 0),
            presentToday: groups.reduce((sum, row) => sum + row.presentToday, 0),
            balancePaise: groups.reduce((sum, row) => sum + row.balancePaise, 0),
            advancesPaise: groups.reduce((sum, row) => sum + row.advancesPaise, 0),
          }}
        />
      ) : page?.rows.length === 0 ? (
        filtered ? (
          <NoResults />
        ) : (
          <EmptyState icon={HardHat} title={t('emptyTitle')} description={t('emptyBody')} />
        )
      ) : page ? (
        <>
          <ul className="flex flex-col gap-2 md:hidden">
            {page.rows.map((row) => {
              const Icon = ROLE_ICONS[row.role];
              return (
                <li key={row.id}>
                  <Link
                    href={`/staff/${row.id}`}
                    className={cn(
                      'border-border bg-surface active:bg-surface-muted flex items-center gap-3 rounded-lg border p-3',
                      !row.isActive && 'opacity-60',
                    )}
                  >
                    <Avatar
                      name={row.name}
                      imageId={row.photoAssetId}
                      gender={row.gender}
                      variant={row.avatarVariant}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {pickText(row.name, row.nameHi, locale)}
                      </p>
                      <p className="text-foreground-muted flex items-center gap-1 text-xs">
                        <Icon aria-hidden className="size-3.5" />
                        {t(`roles.${row.role}`)}
                      </p>
                      <div className="mt-1.5">
                        <StatusChip
                          status={row.todayStatus}
                          label={
                            row.todayStatus ? t(`status.${row.todayStatus}`) : t('noTodayMark')
                          }
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          row.balancePaise > 0 ? 'text-danger' : 'text-foreground-muted',
                        )}
                      >
                        {owedLabel(row)}
                      </p>
                    </div>
                    <ChevronRight aria-hidden className="text-foreground-subtle size-4" />
                  </Link>
                </li>
              );
            })}
          </ul>

          <Table caption={t('title')} minWidth="54rem" className="hidden md:block">
            <THead>
              <SortableTH
                column="name"
                label={t('columns.name')}
                sort={params.sort}
                dir={params.dir}
                basePath="/staff"
                query={query}
              />
              <SortableTH
                column="role"
                label={t('columns.role')}
                sort={params.sort}
                dir={params.dir}
                basePath="/staff"
                query={query}
              />
              <TH>{t('columns.pay')}</TH>
              <TH>{t('columns.today')}</TH>
              <TH align="right">{t('columns.due')}</TH>
              <TH>{t('columns.phone')}</TH>
            </THead>
            <TBody>
              {page.rows.map((row) => (
                <TR key={row.id} className={cn(!row.isActive && 'opacity-60')}>
                  <TD>
                    <Link
                      href={`/staff/${row.id}`}
                      className="hover:text-action flex items-center gap-3 font-medium"
                    >
                      <Avatar
                        name={row.name}
                        imageId={row.photoAssetId}
                        gender={row.gender}
                        variant={row.avatarVariant}
                        size="sm"
                      />
                      <span>
                        {pickText(row.name, row.nameHi, locale)}
                        {!row.isActive && (
                          <Badge tone="neutral" className="ml-2">
                            {t('left')}
                          </Badge>
                        )}
                        {row.userId && (
                          <span className="text-foreground-muted block text-xs">
                            {t('hasLogin')}
                          </span>
                        )}
                      </span>
                    </Link>
                  </TD>
                  <TD muted>{t(`roles.${row.role}`)}</TD>
                  <TD muted className="whitespace-nowrap">
                    {t(`rate.${row.wageType}`, { amount: money(row.wageRatePaise) })}
                  </TD>
                  <TD>
                    <StatusChip
                      status={row.todayStatus}
                      label={row.todayStatus ? t(`status.${row.todayStatus}`) : t('noTodayMark')}
                    />
                  </TD>
                  <TD
                    align="right"
                    className={cn(
                      row.balancePaise > 0 ? 'text-danger font-medium' : 'text-foreground-muted',
                    )}
                  >
                    {money(row.balancePaise)}
                  </TD>
                  <TD muted className="whitespace-nowrap tabular-nums">
                    {row.phone ? formatPhone(row.phone) : '—'}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination
            basePath="/staff"
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
