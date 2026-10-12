import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { History, X } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterPills } from '@/components/ui/filter-pills';
import { GroupedTable } from '@/components/ui/grouped-table';
import { Page } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
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
  TR,
} from '@/components/ui/data-table';
import { DateRangeFilter } from '@/components/production/date-range-filter';
import {
  ACTIVITY_GROUPS,
  ACTIVITY_SORTS,
  activityPersonName,
  actorAvatars,
  groupActivity,
  listActivity,
} from '@/features/activity/queries';
import { ACTIVITY_ENTITIES, activityHref, type ActivityEntity } from '@/features/activity/links';
import { bucketLabel, bucketRange, parseGroup } from '@/features/production/grouping';
import { parseDayRange } from '@/features/production/range';
import { todayKey } from '@/lib/dates';
import { getOrgTimezone } from '@/lib/org';
import { requirePermissionPage } from '@/lib/session';
import { parseTableParams } from '@/lib/table';
import { tableHref } from '@/lib/table-href';
import { formatDateTime } from '@/lib/utils';
import { translateDynamic } from '@/lib/i18n-dynamic';

export const metadata: Metadata = { title: 'Activity log' };

type SearchParams = Record<string, string | string[] | undefined>;

/** Renders the changed fields compactly; values are already free of secrets. */
function describeChanges(changes: Record<string, unknown> | null): string {
  if (!changes) return '';
  return Object.entries(changes)
    .filter(([, value]) => value !== null && typeof value !== 'object')
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermissionPage('/activity', 'activity:read');
  const query = await searchParams;
  const timezone = await getOrgTimezone(viewer.orgId);
  const params = parseTableParams(query, ACTIVITY_SORTS, {
    sort: 'createdAt',
    dir: 'desc',
    size: 50,
  });
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const entity = ACTIVITY_ENTITIES.find((candidate) => candidate === one(query.entity)) ?? null;
  const userId = one(query.user) ?? null;
  const range = parseDayRange(query, todayKey(timezone), 'all');
  const group = parseGroup(query, ACTIVITY_GROUPS);
  const filters = { entity, userId, range, q: params.q };

  const [t, locale, page, groups, personName] = await Promise.all([
    getTranslations('activity'),
    getLocale(),
    group ? Promise.resolve(null) : listActivity(viewer, { ...params, ...filters }, timezone),
    group ? groupActivity(viewer, group, filters, timezone) : Promise.resolve(null),
    activityPersonName(viewer, userId),
  ]);
  const avatars = await actorAvatars(
    viewer,
    page
      ? page.rows.map((row) => row.actorUserId)
      : (groups ?? []).map((row) => (group === 'person' ? row.key : null)),
  );
  const filtered = params.q !== '' || entity !== null || userId !== null || range.preset !== 'all';

  const areaLabel = (key: string) =>
    ACTIVITY_ENTITIES.includes(key as ActivityEntity) ? t(`filters.${key as ActivityEntity}`) : key;

  return (
    <Page size="wide">
      <PageHeader title={t('title')} description={t('description')} />

      <div className="mb-3 flex flex-col gap-2">
        {personName && (
          <p className="bg-action-subtle text-action inline-flex min-h-9 items-center gap-2 self-start rounded-full px-3 text-sm font-medium">
            {t('person.showing', { name: personName })}
            <Link
              href={tableHref('/activity', query, { user: null })}
              aria-label={t('person.clear')}
              className="hover:bg-action/10 -mr-1 rounded-full p-1"
            >
              <X aria-hidden className="size-4" />
            </Link>
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <TableSearch placeholder={t('searchPlaceholder')} />
          {!group && (
            <SortSelect
              className="md:hidden"
              sort={params.sort}
              dir={params.dir}
              options={[
                { sort: 'createdAt', dir: 'desc', label: t('sort.newest') },
                { sort: 'createdAt', dir: 'asc', label: t('sort.oldest') },
              ]}
            />
          )}
        </div>
        <DateRangeFilter range={range} />
        <FilterPills
          label={t('filters.label')}
          param="entity"
          basePath="/activity"
          query={query}
          options={[
            { value: null, label: t('filters.all') },
            ...ACTIVITY_ENTITIES.map((value: ActivityEntity) => ({
              value,
              label: t(`filters.${value}`),
            })),
          ]}
        />
        <FilterPills
          label={t('groups.label')}
          param="group"
          basePath="/activity"
          query={query}
          options={[
            { value: null, label: t('groups.none') },
            ...ACTIVITY_GROUPS.map((value) => ({ value, label: t(`groups.${value}`) })),
          ]}
        />
      </div>

      {groups ? (
        groups.length === 0 ? (
          <NoResults />
        ) : (
          <GroupedTable
            caption={t('title')}
            groupLabel={t(`groups.${group ?? 'person'}`)}
            columns={[
              { key: 'changes', label: t('groupColumns.changes'), format: 'number', bar: true },
              { key: 'lastAt', label: t('groupColumns.lastAt'), format: 'text' },
            ]}
            rows={groups.map((row) => {
              const day = group === 'day' ? bucketRange(row.key, 'day') : null;
              return {
                key: row.key || '—',
                label:
                  group === 'person'
                    ? row.label || t('system')
                    : group === 'area'
                      ? areaLabel(row.key)
                      : bucketLabel(row.key, 'day', locale),
                ...(group === 'person' && !row.key
                  ? {}
                  : {
                      href: tableHref('/activity', query, {
                        group: null,
                        ...(group === 'person'
                          ? { user: row.key }
                          : group === 'area'
                            ? { entity: row.key }
                            : { range: 'custom', from: day?.from ?? null, to: day?.to ?? null }),
                      }),
                    }),
                values: { changes: row.changes, lastAt: formatDateTime(row.lastAt, locale) },
              };
            })}
            totals={{ changes: groups.reduce((sum, row) => sum + row.changes, 0), lastAt: '' }}
          />
        )
      ) : !page || page.rows.length === 0 ? (
        filtered ? (
          <NoResults />
        ) : (
          <EmptyState icon={History} title={t('emptyTitle')} description={t('emptyBody')} />
        )
      ) : (
        <>
          <ul className="flex flex-col gap-2 md:hidden">
            {page.rows.map((row) => {
              const href = activityHref(row.entity, row.entityId);
              const label = translateDynamic(t, `actions.${row.action}`, row.action);
              return (
                <li
                  key={row.id}
                  className="border-border bg-surface flex gap-3 rounded-lg border p-3"
                >
                  <Avatar
                    name={row.actorName ?? t('system')}
                    imageId={
                      row.actorUserId ? (avatars.get(row.actorUserId)?.imageId ?? null) : null
                    }
                    gender={row.actorUserId ? avatars.get(row.actorUserId)?.gender : null}
                    variant={row.actorUserId ? avatars.get(row.actorUserId)?.variant : null}
                    size="sm"
                  />
                  <div className="min-w-0 text-sm">
                    <p>
                      <span className="font-medium">{row.actorName ?? t('system')}</span>
                      {' · '}
                      {href ? (
                        <Link href={href} className="text-action">
                          {label}
                        </Link>
                      ) : (
                        label
                      )}
                    </p>
                    <p className="text-foreground-muted text-xs">
                      {formatDateTime(row.createdAt, locale)}
                    </p>
                    {row.changes && (
                      <p className="text-foreground-subtle truncate text-xs">
                        {describeChanges(row.changes)}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <Table caption={t('title')} minWidth="44rem" className="hidden md:block">
            <THead>
              <SortableTH
                column="createdAt"
                label={t('columns.when')}
                sort={params.sort}
                dir={params.dir}
                basePath="/activity"
                query={query}
                defaultDir="desc"
              />
              <TH>{t('columns.who')}</TH>
              <TH>{t('columns.what')}</TH>
              <TH>{t('columns.details')}</TH>
            </THead>
            <TBody>
              {page.rows.map((row) => {
                const href = activityHref(row.entity, row.entityId);
                const label = translateDynamic(t, `actions.${row.action}`, row.action);
                return (
                  <TR key={row.id}>
                    <TD muted className="whitespace-nowrap">
                      {formatDateTime(row.createdAt, locale)}
                    </TD>
                    <TD className="font-medium">
                      <span className="flex items-center gap-2">
                        <Avatar
                          name={row.actorName ?? t('system')}
                          imageId={
                            row.actorUserId ? (avatars.get(row.actorUserId)?.imageId ?? null) : null
                          }
                          gender={row.actorUserId ? avatars.get(row.actorUserId)?.gender : null}
                          variant={row.actorUserId ? avatars.get(row.actorUserId)?.variant : null}
                          size="sm"
                        />
                        {row.actorUserId ? (
                          <Link
                            href={tableHref('/activity', query, { user: row.actorUserId })}
                            className="hover:text-action"
                          >
                            {row.actorName ?? t('system')}
                          </Link>
                        ) : (
                          (row.actorName ?? t('system'))
                        )}
                      </span>
                    </TD>
                    <TD>
                      {href ? (
                        <Link href={href} className="hover:text-action">
                          {label}
                        </Link>
                      ) : (
                        label
                      )}
                    </TD>
                    <TD muted className="max-w-xs truncate text-xs">
                      {describeChanges(row.changes)}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <Pagination
            basePath="/activity"
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
