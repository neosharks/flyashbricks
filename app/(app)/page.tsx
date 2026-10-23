import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  AlertOctagon,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Factory,
  HandCoins,
  IndianRupee,
  Phone,
  ReceiptIndianRupee,
  Settings,
  Truck,
  Package,
} from 'lucide-react';
import { PinOffer } from '@/components/auth/pin-offer';
import { BrickStack } from '@/components/charts/brick-stack';
import { FactoryScene } from '@/components/illustrations';
import { ActivityList } from '@/components/activity/activity-list';
import { QuickActions, type QuickAction } from '@/components/dashboard/quick-actions';
import { HomeModeSwitch } from '@/components/quick/home-mode-switch';
import { ProductionChart } from '@/components/production/production-chart';
import { MoneyColumnChart } from '@/components/sales/money-chart';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Meter, type Level } from '@/components/ui/meter';
import { StatCard } from '@/components/ui/stat-card';
import { listMaterials } from '@/features/raw-materials/queries';
import { listProducts } from '@/features/stock/queries';
import { dailyProduction, productionSummary } from '@/features/production/queries';
import { presetRange } from '@/features/production/range';
import { dailySales, periodStats } from '@/features/sales/queries';
import { customerStats, listCustomers } from '@/features/customers/queries';
import { listActivity } from '@/features/activity/queries';
import { shouldOfferDevicePin } from '@/features/auth/device-pin';
import { opensInSimpleMode, quickTasksFor } from '@/features/quick/tasks';
import { DEVICE_COOKIE_NAME, HOME_MODE_COOKIE_NAME, PIN_OFFER_COOKIE_NAME } from '@/lib/cookies';
import { formatMoney, formatMoneyCompact } from '@/lib/money';
import { getOrgTimezone } from '@/lib/org';
import { can, type SessionUser } from '@/lib/permissions';
import { formatPhone } from '@/lib/phone';
import { formatQuantity } from '@/lib/quantity';
import { requireUserPage } from '@/lib/session';
import { todayKey } from '@/lib/dates';
import { cn, formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };

const LEVEL_ICON = { good: CheckCircle2, warning: AlertTriangle, critical: AlertOctagon } as const;
const LEVEL_TEXT: Record<Level, string> = {
  good: 'text-success',
  warning: 'text-warning',
  critical: 'text-danger',
};

/** Each section loads only what the viewer may see; nothing is fetched to be hidden. */
async function loadDashboard(user: SessionUser, timezone: string) {
  const materials = can(user, 'rawMaterials:read');
  const production = can(user, 'production:read');
  const sales = can(user, 'sales:read');
  const activity = can(user, 'activity:read');

  const [
    materialRows,
    products,
    summary,
    productionDays,
    salesStats,
    salesDays,
    dueStats,
    topDues,
    recent,
  ] = await Promise.all([
    materials ? listMaterials(user, timezone) : null,
    production ? listProducts(user, { activeOnly: true }) : null,
    production ? productionSummary(user, timezone, presetRange('today', todayKey(timezone))) : null,
    // 60 days: the last 14 are drawn, the rest feed "compared with before" and full screen.
    production ? dailyProduction(user, timezone, 60) : null,
    sales ? periodStats(user, timezone) : null,
    sales ? dailySales(user, timezone, 60) : null,
    sales ? customerStats(user) : null,
    sales
      ? listCustomers(user, {
          q: '',
          sort: 'duePaise',
          dir: 'desc',
          after: null,
          before: null,
          size: 5,
          dues: true,
        })
      : null,
    activity
      ? listActivity(user, {
          q: '',
          sort: 'createdAt',
          dir: 'desc',
          after: null,
          before: null,
          size: 8,
          entity: null,
        })
      : null,
  ]);

  return {
    materialRows,
    products,
    summary,
    productionDays,
    salesStats,
    salesDays,
    dueStats,
    topDues,
    recent,
  };
}

/** Right after a password sign-in, on a device that has no PIN yet. */
async function offerPin(user: SessionUser): Promise<boolean> {
  const jar = await cookies();
  if (!jar.has(PIN_OFFER_COOKIE_NAME)) return false;
  return shouldOfferDevicePin(user, jar.get(DEVICE_COOKIE_NAME)?.value ?? null);
}

export default async function DashboardPage() {
  const user = await requireUserPage('/');
  if (opensInSimpleMode(user, (await cookies()).get(HOME_MODE_COOKIE_NAME)?.value)) {
    redirect('/quick');
  }
  const timezone = await getOrgTimezone(user.orgId);
  const [t, tq, tm, tu, locale, data, pinOffer] = await Promise.all([
    getTranslations('dashboard'),
    getTranslations('quick'),
    getTranslations('rawMaterials'),
    getTranslations('common'),
    getLocale(),
    loadDashboard(user, timezone),
    offerPin(user),
  ]);

  const firstName = user.name.split(/\s+/)[0] ?? user.name;
  const today = new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: timezone,
  }).format(new Date());
  const shortDay = new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

  const actions: QuickAction[] = [
    ...(can(user, 'production:write')
      ? [
          {
            href: '/production?log=1',
            label: t('quick.logProduction'),
            icon: Factory,
            primary: true,
          },
        ]
      : []),
    ...(can(user, 'sales:write')
      ? [{ href: '/sales/new', label: t('quick.newSale'), icon: ReceiptIndianRupee, primary: true }]
      : []),
    ...(can(user, 'rawMaterials:write')
      ? [{ href: '/raw-materials', label: t('quick.purchase'), icon: Truck }]
      : []),
    ...(can(user, 'sales:read')
      ? [{ href: '/sales?status=due', label: t('quick.collect'), icon: HandCoins }]
      : []),
  ];

  const lowMaterials = (data.materialRows ?? []).filter(
    (row) => row.isActive && row.level !== 'good',
  );
  const lowBricks = (data.products ?? []).filter((row) => row.level !== 'good');
  const readyBricks = (data.products ?? []).reduce((sum, row) => sum + row.stockGood, 0);
  const canMake = (data.products ?? []).reduce((sum, row) => sum + (row.canMake ?? 0), 0);
  const threshold = (data.products ?? []).reduce((sum, row) => sum + row.lowStockThreshold, 0);
  const readyLevel: Level = lowBricks.some((row) => row.level === 'critical')
    ? 'critical'
    : lowBricks.length > 0
      ? 'warning'
      : 'good';

  const salesPoints = (data.salesDays ?? []).map((day) => ({
    label: shortDay.format(new Date(`${day.day}T00:00:00Z`)),
    paise: day.totalPaise,
    bricks: day.bricks,
  }));

  // Two tiles a row on a phone: a lone last tile takes the whole row.
  const smallTiles = [data.summary, data.salesStats, data.dueStats].filter(
    (x) => x !== null,
  ).length;
  const lastTileWide = smallTiles % 2 === 1 && 'col-span-2 lg:col-span-1';

  // A brand-new organisation: point at the setup steps instead of empty tiles.
  const fresh =
    data.materialRows?.length === 0 && data.products?.length === 0 && user.role === 'admin';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-foreground-muted text-sm">{today}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('greeting', { name: firstName })}
          </h1>
        </div>
        {quickTasksFor(user).length > 0 && (
          <HomeModeSwitch to="simple" label={tq('home.simpleMode')} />
        )}
      </header>

      {pinOffer && <PinOffer />}

      {fresh ? (
        <Card className="brick-pattern">
          <CardBody className="bg-surface/90 m-3 rounded-lg sm:m-6">
            <FactoryScene className="mb-4 max-w-md" />
            <h2 className="text-lg font-semibold">{t('empty.title')}</h2>
            <p className="text-foreground-muted mt-1 max-w-prose text-sm">{t('empty.body')}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href="/raw-materials">
                  <Package aria-hidden />
                  {t('empty.materials')}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/stock">
                  <Boxes aria-hidden />
                  {t('empty.bricks')}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/settings">
                  <Settings aria-hidden />
                  {t('empty.settings')}
                </Link>
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <QuickActions title={t('quick.title')} actions={actions} />
      )}

      {(data.materialRows !== null || data.products !== null) && (
        <section aria-labelledby="alerts">
          <h2 id="alerts" className="mb-2 text-base font-semibold">
            {t('alerts.title')}
          </h2>
          {lowMaterials.length === 0 && lowBricks.length === 0 ? (
            <p className="border-border bg-success-subtle text-success flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium">
              <CheckCircle2 aria-hidden className="size-4" />
              {t('alerts.allGood')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lowMaterials.map((row) => {
                const Icon = LEVEL_ICON[row.level];
                return (
                  <li key={row.id}>
                    <Link
                      href={`/raw-materials/${row.id}`}
                      className={cn(
                        'border-border bg-surface hover:bg-surface-muted flex min-h-12 items-center gap-3 rounded-lg border px-4 py-2 text-sm',
                      )}
                    >
                      <Icon aria-hidden className={cn('size-5 shrink-0', LEVEL_TEXT[row.level])} />
                      <span className="flex-1">
                        <span className="font-medium">
                          {t('alerts.material', {
                            name: row.name,
                            qty: formatQuantity(row.quantityMilli, locale),
                            unit: tu(`units.${row.unit}`),
                          })}
                        </span>
                        <span className={cn('block text-xs', LEVEL_TEXT[row.level])}>
                          {tm(`levels.${row.level}`)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
              {lowBricks.map((row) => {
                const Icon = LEVEL_ICON[row.level];
                return (
                  <li key={row.id}>
                    <Link
                      href="/stock"
                      className="border-border bg-surface hover:bg-surface-muted flex min-h-12 items-center gap-3 rounded-lg border px-4 py-2 text-sm"
                    >
                      <Icon aria-hidden className={cn('size-5 shrink-0', LEVEL_TEXT[row.level])} />
                      <span className="font-medium">
                        {t('alerts.bricks', {
                          name: row.name,
                          count: formatNumber(row.stockGood, locale),
                        })}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data.products !== null && (
          <StatCard
            label={t('tiles.ready')}
            value={formatNumber(readyBricks, locale)}
            icon={Boxes}
            tone={
              readyLevel === 'good' ? 'success' : readyLevel === 'warning' ? 'warning' : 'danger'
            }
            hint={t('tiles.readyHint', { count: formatNumber(canMake, locale) })}
            className="col-span-2 lg:col-span-1"
          >
            <div className="flex items-end justify-between">
              <BrickStack
                ratio={threshold > 0 ? readyBricks / (threshold * 4) : readyBricks > 0 ? 1 : 0}
                level={readyLevel}
                className="h-14"
              />
            </div>
          </StatCard>
        )}
        {data.summary !== null && (
          <StatCard
            label={t('tiles.madeToday')}
            value={formatNumber(data.summary.todayGood, locale)}
            icon={Factory}
            tone="action"
            hint={
              <span className={cn(data.summary.todayDefective > 0 && 'text-danger')}>
                {t('tiles.madeTodayHint', {
                  count: formatNumber(data.summary.todayDefective, locale),
                })}
              </span>
            }
            className={cn(data.salesStats === null && data.dueStats === null && lastTileWide)}
          />
        )}
        {data.salesStats !== null && (
          <StatCard
            label={t('tiles.soldMonth')}
            value={formatMoneyCompact(data.salesStats.month.totalPaise, locale)}
            icon={IndianRupee}
            tone="success"
            hint={t('tiles.soldMonthHint', {
              bricks: formatNumber(data.salesStats.month.bricks, locale),
            })}
            className={cn(data.dueStats === null && lastTileWide)}
          />
        )}
        {data.dueStats !== null && (
          <StatCard
            label={t('tiles.pending')}
            value={formatMoneyCompact(data.dueStats.receivablePaise, locale)}
            icon={HandCoins}
            tone={data.dueStats.receivablePaise > 0 ? 'danger' : 'success'}
            hint={t('tiles.pendingHint', { count: data.dueStats.withDues })}
            className={cn(lastTileWide)}
          />
        )}
      </section>

      {(data.productionDays !== null || data.salesDays !== null) && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.productionDays !== null && (
            <Card>
              <CardHeader>
                <CardTitle>{t('charts.production')}</CardTitle>
              </CardHeader>
              <CardBody>
                <ProductionChart
                  data={data.productionDays.slice(-14)}
                  history={data.productionDays}
                />
              </CardBody>
            </Card>
          )}
          {data.salesDays !== null && (
            <Card>
              <CardHeader>
                <CardTitle>{t('charts.sales')}</CardTitle>
              </CardHeader>
              <CardBody>
                <MoneyColumnChart
                  title={t('charts.sales')}
                  seriesLabel={t('charts.salesSeries')}
                  emptyLabel={t('charts.empty')}
                  maxAxisLabels={7}
                  data={salesPoints.slice(-14)}
                  history={salesPoints}
                />
              </CardBody>
            </Card>
          )}
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.materialRows !== null && data.materialRows.length > 0 && (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t('materials.title')}</CardTitle>
              <Link
                href="/raw-materials"
                className="text-action -my-3 inline-flex min-h-11 items-center text-sm font-medium"
              >
                {tu('viewAll')}
              </Link>
            </CardHeader>
            <CardBody>
              <ul className="flex flex-col gap-4">
                {data.materialRows
                  .filter((row) => row.isActive)
                  .map((row) => (
                    <li key={row.id}>
                      <Link href={`/raw-materials/${row.id}`} className="group block">
                        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                          <span className="group-hover:text-action font-medium">{row.name}</span>
                          <span className="text-foreground-muted tabular-nums">
                            {formatQuantity(row.quantityMilli, locale)} {tu(`units.${row.unit}`)}
                            {' · '}
                            {row.runwayDays === null
                              ? t('materials.unknown')
                              : t('materials.willLast', {
                                  days: tm('runway.days', { count: Math.floor(row.runwayDays) }),
                                })}
                          </span>
                        </div>
                        <Meter
                          value={row.fill}
                          max={1}
                          level={row.level}
                          label={tm('fill', { name: row.name })}
                        />
                      </Link>
                    </li>
                  ))}
              </ul>
            </CardBody>
          </Card>
        )}

        {data.topDues !== null && (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t('dues.title')}</CardTitle>
              <Link
                href="/customers?dues=1&sort=duePaise&dir=desc"
                className="text-action -my-3 inline-flex min-h-11 items-center text-sm font-medium"
              >
                {tu('viewAll')}
              </Link>
            </CardHeader>
            <CardBody className="p-0 sm:p-0">
              {data.topDues.rows.length === 0 ? (
                <p className="text-foreground-muted p-4 text-sm">{t('dues.empty')}</p>
              ) : (
                <ul className="divide-border divide-y">
                  {data.topDues.rows.map((customer) => (
                    <li key={customer.id} className="flex items-center gap-3 px-4 py-3">
                      <Link href={`/customers/${customer.id}`} className="min-w-0 flex-1">
                        <span className="hover:text-action block truncate font-medium">
                          {customer.name}
                        </span>
                        <span className="text-foreground-muted text-xs tabular-nums">
                          {customer.phones[0] ? formatPhone(customer.phones[0]) : ''}
                        </span>
                      </Link>
                      <span className="text-danger font-semibold tabular-nums">
                        {formatMoney(customer.duePaise, locale)}
                      </span>
                      {customer.phones[0] && (
                        <Button asChild variant="outline" size="icon">
                          <a
                            href={`tel:+91${customer.phones[0]}`}
                            aria-label={t('dues.call', { name: customer.name })}
                          >
                            <Phone aria-hidden />
                          </a>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        )}
      </section>

      {data.recent !== null && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t('activity.title')}</CardTitle>
            <Link
              href="/activity"
              className="text-action -my-3 inline-flex min-h-11 items-center text-sm font-medium"
            >
              {tu('viewAll')}
            </Link>
          </CardHeader>
          <CardBody>
            <ActivityList rows={data.recent.rows} empty={t('activity.empty')} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
