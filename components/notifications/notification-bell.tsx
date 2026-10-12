'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bell, CheckCheck, Settings2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { markAllRead } from '@/features/notifications/actions';
import type { NotificationItem } from '@/features/notifications/types';
import { NotificationRow } from './notification-row';

const POLL_MS = 60_000;

type Summary = { unread: number; items: NotificationItem[] | null };

async function fetchSummary(withItems: boolean): Promise<Summary | null> {
  try {
    const response = await fetch(`/api/notifications/summary${withItems ? '?items=1' : ''}`, {
      cache: 'no-store',
    });
    return response.ok ? ((await response.json()) as Summary) : null;
  } catch {
    // Offline or the server is restarting: keep showing the last known count.
    return null;
  }
}

/**
 * The bell in the header. The count refreshes every minute, whenever the app
 * comes back to the foreground, and after every navigation — so opening a
 * notification clears its dot by the time the next page has loaded.
 */
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const t = useTranslations('notifications');
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async (withItems: boolean) => {
    const summary = await fetchSummary(withItems);
    if (!summary) return;
    setUnread(summary.unread);
    if (summary.items) setItems(summary.items);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void refresh(false), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // The layout persists across navigations, so its server-rendered count would go stale.
  useEffect(() => {
    let current = true;
    void fetchSummary(false).then((summary) => {
      if (current && summary) setUnread(summary.unread);
    });
    return () => {
      current = false;
    };
  }, [pathname]);

  const label = unread > 0 ? t('bellUnread', { count: unread }) : t('bell');

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void refresh(true);
      }}
    >
      <DropdownMenuTrigger
        aria-label={label}
        className="hover:bg-surface-muted relative flex size-10 items-center justify-center rounded-full"
      >
        <Bell aria-hidden className="size-5" />
        {unread > 0 && (
          <span
            aria-hidden
            className="bg-danger absolute top-1 right-1 flex min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[10px] leading-[1.125rem] font-semibold text-white"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-sm font-semibold">{t('title')}</p>
          {unread > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await markAllRead();
                  await refresh(true);
                  router.refresh();
                })
              }
              className="text-action inline-flex min-h-11 items-center gap-1 rounded px-2 text-xs font-medium disabled:opacity-60"
            >
              <CheckCheck aria-hidden className="size-4" />
              {t('markAllRead')}
            </button>
          )}
        </div>

        <div className="max-h-[60dvh] overflow-y-auto p-1">
          {items === null ? (
            <div className="flex justify-center py-8">
              <Spinner label={t('bell')} className="size-5" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-foreground-muted px-3 py-8 text-center text-sm">{t('empty')}</p>
          ) : (
            items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                asChild
                className="block min-h-0 p-0 focus:bg-transparent"
              >
                <div>
                  <NotificationRow item={item} compact onOpen={() => setOpen(false)} />
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>

        <DropdownMenuSeparator className="my-0" />
        <div className="flex">
          <DropdownMenuItem asChild className="flex-1 justify-center rounded-none">
            <Link href="/notifications">{t('viewAll')}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="justify-center rounded-none">
            <Link href="/notifications/settings" aria-label={t('settings')}>
              <Settings2 aria-hidden className="size-4" />
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
