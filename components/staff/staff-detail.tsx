import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronLeft, ChevronRight, FileText, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { FilterPills } from '@/components/ui/filter-pills';
import { DetailFrame, type DetailVariant } from '@/components/ui/detail-frame';
import { PanelMissing } from '@/components/ui/split-view';
import { PageHeader } from '@/components/ui/page-header';
import {
  Pagination,
  SortableTH,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui/data-table';
import { AttendanceCalendar } from '@/components/staff/attendance-calendar';
import { ROLE_ICONS } from '@/components/staff/role-icon';
import { StaffDialog } from '@/components/staff/staff-dialog';
import { StaffPaymentDialog } from '@/components/staff/staff-payment-dialog';
import { StaffPhotoUploader } from '@/components/staff/staff-photo-uploader';
import { STATUS_DOT, STATUS_TONES } from '@/components/staff/status-chip';
import { VoidStaffPaymentDialog } from '@/components/staff/void-staff-payment-dialog';
import {
  getStaff,
  linkableLogins,
  loginName,
  listStaffPayments,
  parsePaymentType,
  STAFF_PAYMENT_SORTS,
  staffMonth,
} from '@/features/staff/queries';
import { monthOf } from '@/features/staff/period';
import { daysInMonth } from '@/features/staff/wages';
import { pickText } from '@/lib/bilingual';
import { todayKey } from '@/lib/dates';
import { formatMoney, intlLocale } from '@/lib/money';
import { getOrgTimezone } from '@/lib/org';
import { can } from '@/lib/permissions';
import { formatPhone } from '@/lib/phone';
import { requirePermissionPage } from '@/lib/session';
import { parseTableParams } from '@/lib/table';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { STAFF_PAYMENT_TYPES } from '@/models/constants';
import { StaffPaidChart } from '@/components/staff/staff-paid-chart';

type SearchParams = Record<string, string | string[] | undefined>;

function shiftMonth(month: string, by: number): string {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (number ?? 1) - 1 + by, 1));
  return date.toISOString().slice(0, 7);
}

/**
 * One worker: attendance, pay and what is owed for the month. The same record shows as its own page and in the
 * panel beside the list; in the panel it ignores the list's query.
 */
export async function StaffDetail({
  id,
  query = {},
  variant = 'page',
}: {
  id: string;
  query?: SearchParams;
  variant?: DetailVariant;
}) {
  const viewer = await requirePermissionPage(`/staff/${id}`, 'staff:read');
  const timeZone = await getOrgTimezone(viewer.orgId);
  const today = todayKey(timeZone);
  const thisMonth = monthOf(today);
  const rawMonth = Array.isArray(query.month) ? query.month[0] : query.month;
  const month =
    rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) && rawMonth <= thisMonth ? rawMonth : thisMonth;

  const staff = await getStaff(viewer, id, timeZone);
  if (!staff) {
    if (variant === 'panel') return <PanelMissing />;
    notFound();
  }

  const canWrite = can(viewer, 'staff:write');
  const paymentParams = parseTableParams(
    query,
    STAFF_PAYMENT_SORTS,
    { sort: 'paidOn', dir: 'desc' },
    'pay_',
  );
  const paymentType = parsePaymentType(query.pay_type);

  const [t, locale, monthData, payments, logins, login] = await Promise.all([
    getTranslations('staff'),
    getLocale(),
    staffMonth(viewer, staff, month, timeZone),
    listStaffPayments(viewer, staff.id, { ...paymentParams, type: paymentType }, timeZone),
    canWrite ? linkableLogins(viewer, staff.id) : Promise.resolve([]),
    staff.userId ? loginName(viewer, staff.userId) : null,
  ]);

  const money = (paise: number) => formatMoney(paise, locale);
  const name = pickText(staff.name, staff.nameHi, locale);
  const otherName = locale === 'hi' ? staff.name : staff.nameHi;
  const RoleIcon = ROLE_ICONS[staff.role];
  const { summary } = monthData;
  const monthLabel = new Intl.DateTimeFormat(intlLocale(locale), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
  const slipTo = monthEnd > today ? today : monthEnd;
  const paymentsTotal =
    summary.payments.wage +
    summary.payments.advance +
    summary.payments.deduction -
    summary.payments.bonus;

  return (
    <DetailFrame variant={variant} size="medium">
      <PageHeader
        title={name}
        back={variant === 'page' ? { href: '/staff', label: t('title') } : undefined}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/staff/${staff.id}/slip?from=${month}-01&to=${slipTo}`}>
                <FileText aria-hidden />
                {t('detail.slip')}
              </Link>
            </Button>
            {canWrite && <StaffDialog staff={staff} logins={logins} today={today} />}
          </>
        }
      >
        <div className="text-foreground-muted mt-2 flex flex-wrap items-center gap-2 text-sm">
          {otherName && <span lang={locale === 'hi' ? 'en' : 'hi'}>{otherName}</span>}
          <Badge tone="info">
            <RoleIcon aria-hidden className="size-3.5" />
            {t(`roles.${staff.role}`)}
          </Badge>
          {!staff.isActive && <Badge tone="neutral">{t('left')}</Badge>}
          <span>{t(`rate.${staff.wageType}`, { amount: money(staff.wageRatePaise) })}</span>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{monthLabel}</CardTitle>
              <div className="flex gap-1">
                <Button asChild variant="ghost" size="icon">
                  <Link
                    href={`/staff/${staff.id}?month=${shiftMonth(month, -1)}`}
                    aria-label={t('detail.previousMonth')}
                  >
                    <ChevronLeft aria-hidden />
                  </Link>
                </Button>
                {month < thisMonth && (
                  <Button asChild variant="ghost" size="icon">
                    <Link
                      href={`/staff/${staff.id}?month=${shiftMonth(month, 1)}`}
                      aria-label={t('detail.nextMonth')}
                    >
                      <ChevronRight aria-hidden />
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <dl className="grid grid-cols-2 gap-3 text-sm @xl:grid-cols-4">
                {(['present', 'half_day', 'absent', 'leave'] as const).map((status) => (
                  <div key={status} className={cn('rounded-md border p-3', STATUS_TONES[status])}>
                    <dt className="flex items-center gap-1.5 text-xs">
                      <span aria-hidden className={cn('size-2 rounded-full', STATUS_DOT[status])} />
                      {t(`status.${status}`)}
                    </dt>
                    <dd className="text-lg font-semibold tabular-nums">{summary.counts[status]}</dd>
                  </div>
                ))}
                <div className="bg-surface-muted rounded-md p-3">
                  <dt className="text-foreground-muted text-xs">{t('detail.overtimeHours')}</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {formatNumber(
                      Math.round((summary.counts.overtimeMinutes / 60) * 10) / 10,
                      locale,
                    )}
                  </dd>
                </div>
                {staff.wageType === 'per_thousand_bricks' && (
                  <div className="bg-surface-muted rounded-md p-3">
                    <dt className="text-foreground-muted text-xs">{t('detail.bricks')}</dt>
                    <dd className="text-lg font-semibold tabular-nums">
                      {formatNumber(summary.counts.bricks, locale)}
                    </dd>
                  </div>
                )}
                <div className="bg-success-subtle rounded-md p-3">
                  <dt className="text-foreground-muted text-xs">{t('detail.earned')}</dt>
                  <dd className="text-success text-lg font-semibold tabular-nums">
                    {money(summary.earnedPaise)}
                  </dd>
                </div>
                <div className="bg-surface-muted rounded-md p-3">
                  <dt className="text-foreground-muted text-xs">{t('detail.paid')}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{money(paymentsTotal)}</dd>
                </div>
              </dl>

              <div>
                <p className="mb-2 text-sm font-medium">{t('detail.calendar')}</p>
                {canWrite && (
                  <p className="text-foreground-muted mb-2 text-xs">{t('detail.calendarHint')}</p>
                )}
                <AttendanceCalendar
                  staffId={staff.id}
                  month={month}
                  marks={monthData.marks}
                  today={today}
                  wageType={staff.wageType}
                  canWrite={canWrite}
                />
              </div>
            </CardBody>
          </Card>

          <StaffPaidChart viewer={viewer} staffId={staff.id} timeZone={timeZone} />

          <Card>
            <CardHeader>
              <CardTitle>{t('detail.payments')}</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <FilterPills
                label={t('payment.filterLabel')}
                param="pay_type"
                basePath={`/staff/${staff.id}`}
                query={query}
                options={[
                  { value: null, label: t('payment.all') },
                  ...STAFF_PAYMENT_TYPES.map((type) => ({
                    value: type,
                    label: t(`payment.types.${type}`),
                  })),
                ]}
              />
              {payments.rows.length === 0 ? (
                <p className="text-foreground-muted text-sm">{t('detail.paymentsEmpty')}</p>
              ) : (
                <>
                  <ul className="flex flex-col gap-2 @3xl:hidden">
                    {payments.rows.map((payment) => (
                      <li
                        key={payment.id}
                        className={cn(
                          'border-border flex items-center justify-between gap-3 rounded-lg border p-3 text-sm',
                          payment.voided && 'text-foreground-subtle',
                        )}
                      >
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'text-base font-semibold tabular-nums',
                              payment.voided && 'line-through',
                              !payment.voided && payment.type === 'bonus' && 'text-success',
                              !payment.voided && payment.type === 'deduction' && 'text-danger',
                            )}
                          >
                            {money(payment.amountPaise)}
                          </p>
                          <p className={cn('font-medium', payment.voided && 'line-through')}>
                            {t(`payment.types.${payment.type}`)}
                          </p>
                          <p className="text-foreground-muted text-xs">
                            {formatDate(`${payment.paidOn}T00:00:00Z`, locale, 'UTC')} ·{' '}
                            {t(`payment.modes.${payment.mode}`)} · {payment.recordedByName}
                          </p>
                          {payment.voided && (
                            <p className="text-xs">
                              {t('payment.voided')}: {payment.voidReason}
                            </p>
                          )}
                          {payment.note && (
                            <p className="text-foreground-muted text-xs">{payment.note}</p>
                          )}
                        </div>
                        {canWrite && !payment.voided && (
                          <VoidStaffPaymentDialog paymentId={payment.id} />
                        )}
                      </li>
                    ))}
                  </ul>
                  <Table
                    caption={t('detail.payments')}
                    minWidth="36rem"
                    className="hidden @3xl:block"
                  >
                    <THead>
                      <SortableTH
                        prefix="pay_"
                        column="paidOn"
                        label={t('payment.columns.date')}
                        sort={paymentParams.sort}
                        dir={paymentParams.dir}
                        basePath={`/staff/${staff.id}`}
                        query={query}
                        defaultDir="desc"
                      />
                      <TH>{t('payment.columns.type')}</TH>
                      <SortableTH
                        prefix="pay_"
                        column="amountPaise"
                        label={t('payment.columns.amount')}
                        sort={paymentParams.sort}
                        dir={paymentParams.dir}
                        basePath={`/staff/${staff.id}`}
                        query={query}
                        align="right"
                        defaultDir="desc"
                      />
                      <TH>{t('payment.columns.mode')}</TH>
                      <TH>{t('payment.columns.by')}</TH>
                      {canWrite && <TH />}
                    </THead>
                    <TBody>
                      {payments.rows.map((payment) => (
                        <TR
                          key={payment.id}
                          className={cn(payment.voided && 'text-foreground-subtle')}
                        >
                          <TD muted className="whitespace-nowrap">
                            {formatDate(`${payment.paidOn}T00:00:00Z`, locale, 'UTC')}
                          </TD>
                          <TD>
                            <span className={cn(payment.voided && 'line-through')}>
                              {t(`payment.types.${payment.type}`)}
                            </span>
                            {payment.voided && (
                              <span className="block text-xs">
                                {t('payment.voided')}: {payment.voidReason}
                              </span>
                            )}
                            {payment.note && (
                              <span className="text-foreground-muted block text-xs">
                                {payment.note}
                              </span>
                            )}
                          </TD>
                          <TD
                            align="right"
                            className={cn(
                              'font-medium',
                              payment.voided && 'line-through',
                              !payment.voided && payment.type === 'bonus' && 'text-success',
                              !payment.voided && payment.type === 'deduction' && 'text-danger',
                            )}
                          >
                            {money(payment.amountPaise)}
                          </TD>
                          <TD muted>{t(`payment.modes.${payment.mode}`)}</TD>
                          <TD muted>{payment.recordedByName}</TD>
                          {canWrite && (
                            <TD>
                              {!payment.voided && <VoidStaffPaymentDialog paymentId={payment.id} />}
                            </TD>
                          )}
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                  <Pagination
                    prefix="pay_"
                    basePath={`/staff/${staff.id}`}
                    query={query}
                    next={payments.next}
                    prev={payments.prev}
                    count={payments.rows.length}
                  />
                </>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="order-first flex flex-col gap-6 @4xl:order-none">
          <Card>
            <CardBody className="flex flex-col gap-4">
              <StaffPhotoUploader
                staffId={staff.id}
                name={staff.name}
                imageId={staff.photoAssetId}
                gender={staff.gender}
                variant={staff.avatarVariant}
                canEdit={canWrite}
                size="xl"
              />
              <div
                className={cn(
                  'rounded-lg p-4',
                  monthData.balancePaise > 0 ? 'bg-danger-subtle' : 'bg-surface-muted',
                )}
              >
                <p className="text-foreground-muted text-sm">
                  {monthData.balancePaise >= 0 ? t('detail.owedNow') : t('detail.paidAheadNow')}
                </p>
                <p
                  className={cn(
                    'text-2xl font-semibold tabular-nums',
                    monthData.balancePaise > 0 && 'text-danger',
                  )}
                >
                  {money(Math.abs(monthData.balancePaise))}
                </p>
                <p className="text-foreground-muted mt-1 text-xs">{t('detail.allTimeHint')}</p>
              </div>
              {canWrite && (
                <div className="grid grid-cols-2 gap-2">
                  <StaffPaymentDialog
                    staffId={staff.id}
                    name={name}
                    type="wage"
                    owedPaise={monthData.balancePaise}
                    today={today}
                    period={{ from: `${month}-01`, to: slipTo }}
                    variant="primary"
                  />
                  <StaffPaymentDialog
                    staffId={staff.id}
                    name={name}
                    type="advance"
                    owedPaise={monthData.balancePaise}
                    today={today}
                  />
                  <StaffPaymentDialog
                    staffId={staff.id}
                    name={name}
                    type="bonus"
                    owedPaise={monthData.balancePaise}
                    today={today}
                  />
                  <StaffPaymentDialog
                    staffId={staff.id}
                    name={name}
                    type="deduction"
                    owedPaise={monthData.balancePaise}
                    today={today}
                  />
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('detail.details')}</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="flex flex-col gap-3 text-sm">
                {staff.phone && (
                  <div>
                    <dt className="text-foreground-muted">{t('form.phone')}</dt>
                    <dd>
                      <a
                        href={`tel:+91${staff.phone}`}
                        className="text-action inline-flex items-center gap-1.5 font-medium"
                      >
                        <Phone aria-hidden className="size-4" />
                        {formatPhone(staff.phone)}
                      </a>
                    </dd>
                  </div>
                )}
                {staff.title && (
                  <div>
                    <dt className="text-foreground-muted">{t('form.title')}</dt>
                    <dd>{staff.title}</dd>
                  </div>
                )}
                {staff.joinedOn && (
                  <div>
                    <dt className="text-foreground-muted">{t('detail.joined')}</dt>
                    <dd>{formatDate(`${staff.joinedOn}T00:00:00Z`, locale, 'UTC')}</dd>
                  </div>
                )}
                {staff.leftOn && (
                  <div>
                    <dt className="text-foreground-muted">{t('form.leftOn')}</dt>
                    <dd>{formatDate(`${staff.leftOn}T00:00:00Z`, locale, 'UTC')}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-foreground-muted">{t('detail.login')}</dt>
                  <dd>
                    {login ? (
                      can(viewer, 'users:read') ? (
                        <Link
                          href={`/users/${staff.userId ?? ''}`}
                          className="text-action font-medium"
                        >
                          {login}
                        </Link>
                      ) : (
                        login
                      )
                    ) : (
                      t('detail.noLogin')
                    )}
                  </dd>
                </div>
                {staff.overtimeRatePaise !== null && (
                  <div>
                    <dt className="text-foreground-muted">{t('form.overtimeRate')}</dt>
                    <dd>{money(staff.overtimeRatePaise)}</dd>
                  </div>
                )}
                {staff.address && (
                  <div>
                    <dt className="text-foreground-muted">{t('form.address')}</dt>
                    <dd>{staff.address}</dd>
                  </div>
                )}
                {staff.notes && (
                  <div>
                    <dt className="text-foreground-muted">{t('form.notes')}</dt>
                    <dd className="whitespace-pre-line">{staff.notes}</dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </DetailFrame>
  );
}
