'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Bell,
  Boxes,
  CalendarCheck,
  HardHat,
  ClipboardList,
  DatabaseBackup,
  Factory,
  LayoutDashboard,
  Menu,
  Package,
  ReceiptIndianRupee,
  RefreshCw,
  Settings,
  UserCog,
  Users,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import type { NavIcon, NavItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const ICONS: Record<NavIcon, typeof Boxes> = {
  dashboard: LayoutDashboard,
  rawMaterials: Package,
  production: Factory,
  stock: Boxes,
  sales: ReceiptIndianRupee,
  customers: Users,
  users: UserCog,
  activity: ClipboardList,
  backup: DatabaseBackup,
  settings: Settings,
  notifications: Bell,
  staff: HardHat,
  attendance: CalendarCheck,
  updates: RefreshCw,
};

function matches(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Only the most specific item is current: on /staff/attendance that is
 * "Attendance", not also "Staff", whose /staff is a prefix of it.
 */
function activeHref(pathname: string, items: NavItem[]): string | null {
  return (
    items
      .filter((item) => matches(pathname, item.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null
  );
}

/** Desktop sidebar, grouped by business area. */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const current = activeHref(pathname, items);
  const groups = ['main', 'manufacturing', 'selling', 'people', 'admin'] as const;

  return (
    <nav aria-label={t('main')} className="flex flex-col gap-5">
      {groups.map((group) => {
        const groupItems = items.filter((item) => item.group === group);
        if (groupItems.length === 0) return null;
        return (
          <div key={group}>
            {group !== 'main' && (
              <p className="text-foreground-subtle mb-1 px-3 text-xs font-medium tracking-wide uppercase">
                {t(`groups.${group}`)}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {groupItems.map((item) => {
                const Icon = ICONS[item.icon];
                const active = item.href === current;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors',
                        active
                          ? 'bg-action-subtle text-action'
                          : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
                      )}
                    >
                      <Icon aria-hidden className="size-4 shrink-0" />
                      {t(item.label)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/**
 * Phone tab bar: the four most-used sections a person can open, plus "More"
 * for the rest. Sits above the home indicator on notched phones.
 */
export function MobileTabBar({ items, extra }: { items: NavItem[]; extra?: React.ReactNode }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = activeHref(pathname, items);

  const priority: NavIcon[] = ['dashboard', 'rawMaterials', 'production', 'sales'];
  const primary = priority
    .map((icon) => items.find((item) => item.icon === icon))
    .filter((item): item is NavItem => item !== undefined);
  const rest = items.filter((item) => !primary.includes(item));
  const restActive = rest.some((item) => item.href === current);

  const tabClass = (active: boolean) =>
    cn(
      'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
      active ? 'text-action' : 'text-foreground-muted',
    );

  return (
    <nav
      aria-label={t('main')}
      className="border-border bg-surface/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="flex">
        {primary.map((item) => {
          const Icon = ICONS[item.icon];
          const active = item.href === current;
          return (
            <li key={item.href} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={tabClass(active)}
              >
                <Icon aria-hidden className="size-5" />
                {t(item.label)}
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className={tabClass(restActive)}>
              <Menu aria-hidden className="size-5" />
              {t('more')}
            </DialogTrigger>
            <DialogContent title={t('more')}>
              <ul className="grid grid-cols-3 gap-2">
                {rest.map((item) => {
                  const Icon = ICONS[item.icon];
                  const active = item.href === current;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'border-border flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-center text-xs font-medium',
                          active
                            ? 'bg-action-subtle text-action border-action'
                            : 'hover:bg-surface-muted',
                        )}
                      >
                        <Icon aria-hidden className="size-5" />
                        {t(item.label)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {extra}
            </DialogContent>
          </Dialog>
        </li>
      </ul>
    </nav>
  );
}
