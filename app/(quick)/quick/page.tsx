import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  CalendarCheck,
  ChevronRight,
  Factory,
  HandCoins,
  ReceiptIndianRupee,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { HomeModeSwitch } from '@/components/quick/home-mode-switch';
import { productionSummary } from '@/features/production/queries';
import { presetRange } from '@/features/production/range';
import { resolveRange } from '@/features/sales/filters';
import { summarizeSales } from '@/features/sales/queries';
import { quickTasksFor, type QuickTask } from '@/features/quick/tasks';
import { todayKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { getOrgTimezone } from '@/lib/org';
import { can } from '@/lib/permissions';
import { requireUserPage } from '@/lib/session';
import { cn, formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'Simple mode' };

const TASKS: Record<QuickTask, { href: string; icon: LucideIcon; tone: string }> = {
  production: {
    href: '/quick/production',
    icon: Factory,
    tone: 'bg-action text-action-foreground',
  },
  sale: {
    href: '/quick/sale',
    icon: ReceiptIndianRupee,
    tone: 'bg-success text-action-foreground',
  },
  payment: { href: '/quick/payment', icon: HandCoins, tone: 'bg-warning text-action-foreground' },
  attendance: {
    href: '/quick/attendance',
    icon: CalendarCheck,
    tone: 'bg-holiday text-action-foreground',
  },
  purchase: { href: '/quick/purchase', icon: Truck, tone: 'bg-info text-action-foreground' },
};

/** The big buttons: only the tasks this person may do, and today's two numbers. */
export default async function QuickHomePage() {
  const user = await requireUserPage('/quick');
  const timezone = await getOrgTimezone(user.orgId);
  const today = todayKey(timezone);
  const [t, locale, made, sold] = await Promise.all([
    getTranslations('quick'),
    getLocale(),
    can(user, 'production:read')
      ? productionSummary(user, timezone, presetRange('today', today))
      : null,
    can(user, 'sales:read')
      ? summarizeSales(
          user,
          {
            range: 'today',
            status: null,
            customerId: null,
            productId: null,
            rateBand: null,
            ...resolveRange('today', { from: null, to: null }, timezone),
          },
          '',
          timezone,
        )
      : null,
  ]);
  const tasks = quickTasksFor(user);
  const firstName = user.name.split(/\s+/)[0] ?? user.name;

  return (
    <div className="flex flex-col gap-5 py-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('home.greeting', { name: firstName })}
        </h1>
        <p className="text-foreground-muted mt-1">{t('home.subtitle')}</p>
      </header>

      {(made !== null || sold !== null) && (
        <dl
          className={cn(
            'grid gap-3',
            made !== null && sold !== null ? 'grid-cols-2' : 'grid-cols-1',
          )}
        >
          {made !== null && (
            <div className="border-border bg-surface rounded-xl border p-3">
              <dt className="text-foreground-muted text-sm">{t('home.madeToday')}</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {formatNumber(made.todayGood, locale)}
              </dd>
            </div>
          )}
          {sold !== null && (
            <div className="border-border bg-surface rounded-xl border p-3">
              <dt className="text-foreground-muted text-sm">{t('home.soldToday')}</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {formatMoney(sold.totalPaise, locale)}
              </dd>
            </div>
          )}
        </dl>
      )}

      {tasks.length === 0 ? (
        <p className="border-border bg-surface rounded-xl border p-4">{t('home.nothing')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => {
            const { href, icon: Icon, tone } = TASKS[task];
            return (
              <li key={task}>
                <Link
                  href={href}
                  className="border-border bg-surface hover:bg-surface-muted active:bg-border flex min-h-24 items-center gap-4 rounded-2xl border p-4 shadow-xs transition-colors"
                >
                  <span
                    className={cn(
                      'flex size-14 shrink-0 items-center justify-center rounded-2xl',
                      tone,
                    )}
                  >
                    <Icon aria-hidden className="size-7" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xl leading-snug font-semibold">
                      {t(`tasks.${task}.title`)}
                    </span>
                    <span className="text-foreground-muted block text-sm">
                      {t(`tasks.${task}.hint`)}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="text-foreground-subtle size-6 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <HomeModeSwitch to="full" label={t('home.fullApp')} variant="ghost" className="self-center" />
    </div>
  );
}
