import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Clock, UserCheck, UserPlus, UserX, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';
import { FilterPills } from '@/components/ui/filter-pills';
import { GroupedTable } from '@/components/ui/grouped-table';
import { Page } from '@/components/ui/page';
import { SortSelect } from '@/components/ui/sort-select';
import { PageHeader } from '@/components/ui/page-header';
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
import { AccessSummary } from '@/components/users/access-matrix';
import { UserStatusBadge } from '@/components/users/user-status-badge';
import {
  countUsers,
  groupUsers,
  listUsers,
  USER_GROUPS,
  USER_SORTS,
  USER_STATUSES,
} from '@/features/users/queries';
import { parseGroup } from '@/features/production/grouping';
import { ROLES } from '@/lib/permissions';
import { tableHref } from '@/lib/table-href';
import { can } from '@/lib/permissions';
import { formatPhone } from '@/lib/phone';
import { requirePermissionPage } from '@/lib/session';
import { parseTableParams } from '@/lib/table';
import { formatDateTime, formatNumber } from '@/lib/utils';
import { Worker } from '@/components/illustrations';

export const metadata: Metadata = { title: 'Employees' };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermissionPage('/users', 'users:read');
  const query = await searchParams;
  const params = parseTableParams(query, USER_SORTS, { sort: 'name', dir: 'asc' });
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const status = USER_STATUSES.find((value) => value === one(query.status)) ?? null;
  const role = ROLES.find((value) => value === one(query.role)) ?? null;
  const group = parseGroup(query, USER_GROUPS);
  const filters = { status, role, q: params.q };

  const [t, tc, locale, page, counts, groups] = await Promise.all([
    getTranslations('users'),
    getTranslations('common'),
    getLocale(),
    group ? Promise.resolve(null) : listUsers(viewer, { ...params, ...filters }),
    countUsers(viewer),
    group ? groupUsers(viewer, group, filters) : Promise.resolve(null),
  ]);
  const canWrite = can(viewer, 'users:write');
  const filtered = params.q !== '' || status !== null || role !== null;

  return (
    <Page size="wide">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          canWrite && (
            <Button asChild>
              <Link href="/users/new">
                <UserPlus aria-hidden />
                {t('add')}
              </Link>
            </Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label={t('stats.active')}
          value={formatNumber(counts.active, locale)}
          icon={UserCheck}
          tone="success"
        />
        <StatCard
          label={t('stats.neverSignedIn')}
          value={formatNumber(counts.neverSignedIn, locale)}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label={t('stats.disabled')}
          value={formatNumber(counts.disabled, locale)}
          icon={UserX}
          tone={counts.disabled > 0 ? 'danger' : 'neutral'}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="mb-3 flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <TableSearch placeholder={t('searchPlaceholder')} />
          {!group && (
            <SortSelect
              className="md:hidden"
              sort={params.sort}
              dir={params.dir}
              options={[
                { sort: 'name', dir: 'asc', label: t('sort.name') },
                { sort: 'createdAt', dir: 'desc', label: t('sort.newest') },
                { sort: 'lastLoginAt', dir: 'desc', label: t('sort.lastLogin') },
              ]}
            />
          )}
        </div>
        <FilterPills
          label={t('filters.label')}
          param="status"
          basePath="/users"
          query={query}
          options={[
            { value: null, label: t('filters.all') },
            { value: 'active', label: t('filters.active') },
            { value: 'pending', label: t('filters.pending') },
            { value: 'disabled', label: t('filters.disabled') },
          ]}
        />
        <FilterPills
          label={t('filters.roleLabel')}
          param="role"
          basePath="/users"
          query={query}
          options={[
            { value: null, label: t('filters.all') },
            ...ROLES.map((value) => ({ value, label: t(`roles.${value}`) })),
          ]}
        />
        <FilterPills
          label={t('groups.label')}
          param="group"
          basePath="/users"
          query={query}
          options={[
            { value: null, label: t('groups.none') },
            ...USER_GROUPS.map((value) => ({ value, label: t(`groups.${value}`) })),
          ]}
        />
      </div>

      {groups ? (
        groups.length === 0 ? (
          <NoResults />
        ) : (
          <GroupedTable
            caption={t('title')}
            groupLabel={t(`groups.${group ?? 'role'}`)}
            columns={[
              { key: 'people', label: t('groupColumns.people'), format: 'number', bar: true },
              { key: 'active', label: t('groupColumns.active'), format: 'number' },
              { key: 'pending', label: t('groupColumns.pending'), format: 'number' },
              { key: 'disabled', label: t('groupColumns.disabled'), format: 'number' },
            ]}
            rows={groups.map((row) => ({
              key: row.key,
              label:
                group === 'role'
                  ? t(`roles.${row.key as (typeof ROLES)[number]}`)
                  : t(
                      `status.${row.key === 'pending' ? 'pendingPassword' : (row.key as 'active' | 'disabled')}`,
                    ),
              href: tableHref('/users', query, {
                group: null,
                ...(group === 'role' ? { role: row.key } : { status: row.key }),
              }),
              values: {
                people: row.people,
                active: row.active,
                pending: row.pending,
                disabled: row.disabled,
              },
            }))}
            totals={{
              people: groups.reduce((sum, row) => sum + row.people, 0),
              active: groups.reduce((sum, row) => sum + row.active, 0),
              pending: groups.reduce((sum, row) => sum + row.pending, 0),
              disabled: groups.reduce((sum, row) => sum + row.disabled, 0),
            }}
          />
        )
      ) : !page || page.rows.length === 0 ? (
        filtered ? (
          <NoResults />
        ) : (
          <EmptyState
            illustration={<Worker className="h-full w-auto" />}
            icon={Users}
            title={t('emptyTitle')}
            description={t('emptyBody')}
          />
        )
      ) : (
        <>
          <ul className="flex flex-col gap-2 md:hidden">
            {page.rows.map((user) => (
              <li key={user.id}>
                <Link
                  href={`/users/${user.id}`}
                  className="border-border bg-surface active:bg-surface-muted flex items-center gap-3 rounded-lg border p-3"
                >
                  <Avatar
                    name={user.name}
                    imageId={user.avatarAssetId}
                    gender={user.gender}
                    variant={user.avatarVariant}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{user.name}</p>
                    <p className="text-foreground-muted truncate text-xs">
                      {[user.jobTitle, t(`roles.${user.role}`)].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-foreground-subtle text-xs">
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt, locale) : tc('never')}
                    </p>
                  </div>
                  <span className="flex flex-col items-end gap-1">
                    <UserStatusBadge user={user} />
                    {!user.pinSignInAllowed && <Badge tone="neutral">{t('pinOff')}</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Table caption={t('title')} minWidth="52rem" className="hidden md:block">
            <THead>
              <SortableTH
                column="name"
                label={t('columns.name')}
                sort={params.sort}
                dir={params.dir}
                basePath="/users"
                query={query}
              />
              <TH>{t('columns.phone')}</TH>
              <TH>{t('columns.role')}</TH>
              <TH>{t('columns.access')}</TH>
              <TH>{t('columns.status')}</TH>
              <SortableTH
                column="lastLoginAt"
                label={t('columns.lastLogin')}
                sort={params.sort}
                dir={params.dir}
                basePath="/users"
                query={query}
                defaultDir="desc"
              />
            </THead>
            <TBody>
              {page.rows.map((user) => (
                <TR key={user.id}>
                  <TD>
                    <span className="flex items-center gap-3">
                      <Avatar
                        name={user.name}
                        imageId={user.avatarAssetId}
                        gender={user.gender}
                        variant={user.avatarVariant}
                        size="sm"
                      />
                      <span>
                        <Link href={`/users/${user.id}`} className="hover:text-action font-medium">
                          {user.name}
                        </Link>
                        {user.jobTitle && (
                          <span className="text-foreground-muted block text-xs">
                            {user.jobTitle}
                          </span>
                        )}
                      </span>
                    </span>
                  </TD>
                  <TD muted className="whitespace-nowrap tabular-nums">
                    {formatPhone(user.phone)}
                  </TD>
                  <TD>
                    <Badge tone={user.role === 'admin' ? 'info' : 'neutral'}>
                      {t(`roles.${user.role}`)}
                    </Badge>
                  </TD>
                  <TD>
                    <AccessSummary permissions={user.permissions} admin={user.role === 'admin'} />
                  </TD>
                  <TD>
                    <span className="flex flex-wrap gap-1">
                      <UserStatusBadge user={user} />
                      {!user.pinSignInAllowed && <Badge tone="neutral">{t('pinOff')}</Badge>}
                    </span>
                  </TD>
                  <TD muted className="whitespace-nowrap">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt, locale) : tc('never')}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination
            basePath="/users"
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
