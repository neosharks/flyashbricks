import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { BellOff, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterPills } from '@/components/ui/filter-pills';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/data-table';
import { SortSelect } from '@/components/ui/sort-select';
import { relativeDay, sectionsByDay } from '@/components/notifications/day-sections';
import { todayKey } from '@/lib/dates';
import { getOrgTimezone } from '@/lib/org';
import { formatDate } from '@/lib/utils';
import { MarkAllReadButton } from '@/components/notifications/mark-all-read-button';
import { NotificationRow } from '@/components/notifications/notification-row';
import {
  listNotifications,
  NOTIFICATION_SORTS,
  unreadCount,
} from '@/features/notifications/queries';
import { requireUserPage } from '@/lib/session';
import { parseTableParams } from '@/lib/table';
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from '@/models/constants';
import { Page } from '@/components/ui/page';

export const metadata: Metadata = { title: 'Notifications' };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireUserPage('/notifications');
  const query = await searchParams;
  const params = parseTableParams(query, NOTIFICATION_SORTS, {
    sort: 'createdAt',
    dir: 'desc',
    size: 25,
  });
  const show = Array.isArray(query.show) ? query.show[0] : query.show;
  const unreadOnly = show === 'unread';
  const rawCategory = Array.isArray(query.category) ? query.category[0] : query.category;
  const category =
    NOTIFICATION_CATEGORIES.find((candidate: NotificationCategory) => candidate === rawCategory) ??
    null;

  const [t, tc, locale, timezone, page, unread] = await Promise.all([
    getTranslations('notifications'),
    getTranslations('common'),
    getLocale(),
    getOrgTimezone(viewer.orgId),
    listNotifications(viewer, { ...params, unreadOnly, category }),
    unreadCount(viewer),
  ]);

  return (
    <Page size="narrow">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <>
            {unread > 0 && <MarkAllReadButton />}
            <Button asChild variant="ghost">
              <Link href="/notifications/settings">
                <Settings2 aria-hidden />
                {t('settings')}
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2">
        <SortSelect
          className="sm:w-56"
          sort={params.sort}
          dir={params.dir}
          options={[
            { sort: 'createdAt', dir: 'desc', label: t('sort.newest') },
            { sort: 'createdAt', dir: 'asc', label: t('sort.oldest') },
          ]}
        />
        <FilterPills
          label={t('filters.label')}
          param="show"
          basePath="/notifications"
          query={query}
          options={[
            { value: null, label: t('filters.all') },
            { value: 'unread', label: t('filters.unread'), count: unread },
          ]}
        />
        <FilterPills
          label={t('filters.categoryLabel')}
          param="category"
          basePath="/notifications"
          query={query}
          options={[
            { value: null, label: t('filters.all') },
            ...NOTIFICATION_CATEGORIES.map((value) => ({ value, label: t(`categories.${value}`) })),
          ]}
        />
      </div>

      {page.rows.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={unreadOnly ? t('emptyUnread') : t('empty')}
          description={t('emptyHint')}
        />
      ) : (
        <>
          <div className="flex flex-col gap-5">
            {sectionsByDay(page.rows, timezone).map((section) => {
              const relative = relativeDay(section.day, todayKey(timezone));
              return (
                <section key={section.day} aria-labelledby={`day-${section.day}`}>
                  <h2
                    id={`day-${section.day}`}
                    className="text-foreground-muted mb-2 text-xs font-semibold tracking-wide uppercase"
                  >
                    {relative
                      ? tc(relative)
                      : formatDate(`${section.day}T00:00:00Z`, locale, 'UTC')}
                  </h2>
                  <ul className="border-border bg-surface divide-border divide-y rounded-lg border p-1">
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <NotificationRow item={item} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
          <Pagination
            basePath="/notifications"
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
