import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ActivityRow } from '@/features/users/types';
import { formatDateTime } from '@/lib/utils';
import { translateDynamic } from '@/lib/i18n-dynamic';
import { activityHref } from '@/features/activity/links';

/** A compact timeline of audit entries, for detail pages. */
export async function ActivityList({
  rows,
  empty,
  showActor = true,
}: {
  rows: ActivityRow[];
  empty: string;
  showActor?: boolean;
}) {
  const [t, locale] = await Promise.all([getTranslations('activity'), getLocale()]);
  if (rows.length === 0) return <p className="text-foreground-muted text-sm">{empty}</p>;

  return (
    <ol className="border-border relative flex flex-col gap-4 border-l pl-5">
      {rows.map((row) => {
        const href = activityHref(row.entity, row.entityId);
        const label = translateDynamic(t, `actions.${row.action}`, row.action);
        return (
          <li key={row.id} className="relative text-sm">
            <span
              aria-hidden
              className="bg-surface border-border-strong absolute top-1.5 -left-[1.6rem] size-3 rounded-full border-2"
            />
            <p>
              {showActor && <span className="font-medium">{row.actorName ?? t('system')} · </span>}
              {href ? (
                <Link href={href} className="hover:text-action underline-offset-2 hover:underline">
                  {label}
                </Link>
              ) : (
                label
              )}
            </p>
            <p className="text-foreground-muted text-xs">{formatDateTime(row.createdAt, locale)}</p>
          </li>
        );
      })}
    </ol>
  );
}
