'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { NotificationItem } from '@/features/notifications/types';
import { cn, timeAgo } from '@/lib/utils';
import { NotificationIcon } from './notification-icon';

/**
 * One notification. The whole row is the link to `/n/<id>`, which marks it
 * read and lands on the record it is about — the same route email and SMS
 * links use, so every entry point behaves identically.
 */
export function NotificationRow({
  item,
  compact = false,
  onOpen,
}: {
  item: NotificationItem;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const t = useTranslations('notifications');
  const locale = useLocale();

  return (
    <Link
      href={`/n/${item.id}`}
      {...(onOpen ? { onClick: onOpen } : {})}
      className={cn(
        'hover:bg-surface-muted flex items-start gap-3 rounded-lg px-3 transition-colors',
        compact ? 'py-2.5' : 'py-3.5',
        !item.read && 'bg-action-subtle/40',
      )}
    >
      <NotificationIcon type={item.type} severity={item.severity} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cn('text-sm', item.read ? 'font-medium' : 'font-semibold')}>
            {item.title}
          </span>
          {!item.read && (
            <span className="bg-action mt-1.5 size-2 shrink-0 rounded-full">
              <span className="sr-only">{t('unread')}</span>
            </span>
          )}
        </span>
        <span className={cn('text-foreground-muted block text-sm', compact && 'line-clamp-2')}>
          {item.body}
        </span>
        <time dateTime={item.createdAt} className="text-foreground-subtle mt-0.5 block text-xs">
          {timeAgo(item.createdAt, locale)}
        </time>
      </span>
    </Link>
  );
}
