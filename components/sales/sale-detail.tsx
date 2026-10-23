import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Ban, FileText, Phone, Truck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { CancelSaleDialog } from '@/components/sales/cancel-sale-dialog';
import { PaymentDialog } from '@/components/sales/payment-dialog';
import { SaleStatusBadge } from '@/components/sales/sale-status-badge';
import { getOrgSummary } from '@/lib/org';
import { getSale } from '@/features/sales/queries';
import { daysBetween, todayKey } from '@/lib/dates';
import { formatSaleNumber } from '@/lib/ids';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { formatPhone } from '@/lib/phone';
import { requirePermissionPage } from '@/lib/session';
import { cn, formatDate, formatDateTime, formatNumber, formatPercent } from '@/lib/utils';
import { DetailFrame, type DetailVariant } from '@/components/ui/detail-frame';
import { PanelMissing } from '@/components/ui/split-view';
import { RateComparison } from '@/components/sales/rate-comparison';

/**
 * One sale: what was sold, what is still due, and its payments. The same
 * record shows as its own page and in the panel beside the sales list.
 */
export async function SaleDetail({
  id,
  variant = 'page',
}: {
  id: string;
  variant?: DetailVariant;
}) {
  const viewer = await requirePermissionPage(`/sales/${id}`, 'sales:read');
  const [sale, org, t, tc, locale] = await Promise.all([
    getSale(viewer, id),
    getOrgSummary(viewer.orgId),
    getTranslations('sales'),
    getTranslations('common'),
    getLocale(),
  ]);
  if (!sale) {
    if (variant === 'panel') return <PanelMissing />;
    notFound();
  }

  const money = (paise: number) => formatMoney(paise, locale);
  const open = !sale.voided;
  const pendingDays = daysBetween(new Date(sale.date), new Date());
  const rate = formatPercent(sale.gstRateBps / 10_000, locale);

  return (
    <DetailFrame variant={variant} size="medium">
      <PageHeader
        title={t('detail.bill', { number: formatSaleNumber(sale.number) })}
        back={variant === 'page' ? { href: '/sales', label: t('title') } : undefined}
        actions={
          <>
            {open && sale.duePaise > 0 && can(viewer, 'sales:write') && (
              <PaymentDialog
                saleId={sale.id}
                duePaise={sale.duePaise}
                today={todayKey(org.timezone)}
              />
            )}
            <Button asChild variant="outline" size="lg" className="w-full @xl:w-auto">
              <Link href={`/sales/${sale.id}/invoice`}>
                <FileText aria-hidden />
                {t('invoice.open')}
              </Link>
            </Button>
          </>
        }
      >
        <div className="text-foreground-muted mt-2 flex flex-wrap items-center gap-2 text-sm">
          <SaleStatusBadge status={sale.status} voided={sale.voided} />
          <span>{formatDate(sale.date, locale)}</span>
          <span className="font-mono text-xs">{sale.invoiceNumber}</span>
        </div>
      </PageHeader>

      {sale.voided && (
        <Alert
          tone="info"
          title={t('detail.voided', { date: formatDateTime(sale.voidedAt ?? sale.date, locale) })}
          className="mb-6"
        >
          {sale.voidReason && <p>{t('detail.voidReason', { reason: sale.voidReason })}</p>}
        </Alert>
      )}

      {/* The headline: how much is still to come. */}
      <div className="mb-6 grid grid-cols-2 gap-3 @xl:grid-cols-3">
        <div className="border-border bg-surface rounded-lg border p-4">
          <p className="text-foreground-muted text-sm">{t('detail.total')}</p>
          <p className="text-2xl font-semibold tabular-nums">{money(sale.totalPaise)}</p>
        </div>
        <div className="border-border bg-surface rounded-lg border p-4">
          <p className="text-foreground-muted text-sm">{t('detail.paid')}</p>
          <p className="text-success text-2xl font-semibold tabular-nums">
            {money(sale.paidPaise)}
          </p>
        </div>
        <div className="border-border bg-surface col-span-2 rounded-lg border p-4 @xl:col-span-1">
          <p className="text-foreground-muted text-sm">{t('detail.due')}</p>
          <p
            className={cn(
              'text-2xl font-semibold tabular-nums',
              open && sale.duePaise > 0 ? 'text-danger' : 'text-success',
            )}
          >
            {money(open ? sale.duePaise : 0)}
          </p>
          {open && sale.duePaise > 0 && (
            <p className="text-danger text-xs font-medium">
              {t('detail.pendingFor', { days: tc('days', { count: pendingDays }) })}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t('detail.item')}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <ul className="divide-border divide-y">
              {sale.lines.map((line) => (
                <li
                  key={line.productId}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0"
                >
                  <div>
                    <p className="font-medium">{line.productName}</p>
                    <p className="text-foreground-muted text-sm tabular-nums">
                      {formatNumber(line.qty, locale)} × {money(line.ratePaise)}
                    </p>
                    <RateComparison
                      ratePaise={line.ratePaise}
                      defaultRatePaise={line.defaultRatePaise}
                      variant="detail"
                    />
                  </div>
                  <p className="font-semibold tabular-nums">{money(line.amountPaise)}</p>
                </li>
              ))}
            </ul>
            <dl className="border-border flex flex-col gap-1.5 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-muted">{t('detail.avgRate')}</dt>
                <dd className="tabular-nums">
                  {t('perBrick', { rate: money(sale.avgRatePaise) })}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-muted">{t('detail.subtotal')}</dt>
                <dd className="tabular-nums">{money(sale.subtotalPaise)}</dd>
              </div>
              {sale.deliveryPaise > 0 && (
                <div className="flex justify-between">
                  <dt className="text-foreground-muted">{t('detail.delivery')}</dt>
                  <dd className="tabular-nums">{money(sale.deliveryPaise)}</dd>
                </div>
              )}
              {sale.discountPaise > 0 && (
                <div className="flex justify-between">
                  <dt className="text-foreground-muted">{t('detail.discount')}</dt>
                  <dd className="tabular-nums">− {money(sale.discountPaise)}</dd>
                </div>
              )}
              {sale.cgstPaise > 0 && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-foreground-muted">
                      {t('invoice.cgst', { rate: formatPercent(sale.gstRateBps / 20_000, locale) })}
                    </dt>
                    <dd className="tabular-nums">{money(sale.cgstPaise)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground-muted">
                      {t('invoice.sgst', { rate: formatPercent(sale.gstRateBps / 20_000, locale) })}
                    </dt>
                    <dd className="tabular-nums">{money(sale.sgstPaise)}</dd>
                  </div>
                </>
              )}
              {sale.igstPaise > 0 && (
                <div className="flex justify-between">
                  <dt className="text-foreground-muted">{t('invoice.igst', { rate })}</dt>
                  <dd className="tabular-nums">{money(sale.igstPaise)}</dd>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold">
                <dt>{t('detail.total')}</dt>
                <dd className="tabular-nums">{money(sale.totalPaise)}</dd>
              </div>
            </dl>
            {sale.note && (
              <p className="bg-surface-muted rounded-md p-3 text-sm whitespace-pre-line">
                <span className="text-foreground-muted">{t('detail.note')}: </span>
                {sale.note}
              </p>
            )}
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.billTo')}</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-2 text-sm">
              <Link
                href={`/customers/${sale.customerId}`}
                className="text-action text-base font-semibold"
              >
                {sale.customerName}
              </Link>
              <a
                href={`tel:+91${sale.customerPhone}`}
                className="inline-flex min-h-11 items-center gap-2 tabular-nums"
              >
                <Phone aria-hidden className="text-action size-4" />
                {formatPhone(sale.customerPhone)}
              </a>
              {(sale.vehicleNo ?? sale.deliveryAddress) && (
                <p className="flex gap-2">
                  <Truck aria-hidden className="text-foreground-muted mt-0.5 size-4 shrink-0" />
                  <span>{[sale.vehicleNo, sale.deliveryAddress].filter(Boolean).join(' · ')}</span>
                </p>
              )}
              <p className="text-foreground-muted text-xs">
                {t('detail.createdBy', {
                  name: sale.createdByName,
                  date: formatDateTime(sale.createdAt, locale),
                })}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('detail.payments')}</CardTitle>
            </CardHeader>
            <CardBody>
              {sale.payments.length === 0 ? (
                <p className="text-foreground-muted text-sm">{t('detail.noPayments')}</p>
              ) : (
                <ol className="border-border flex flex-col gap-4 border-l pl-5">
                  {sale.payments.map((payment) => (
                    <li key={payment.id} className="relative text-sm">
                      <span
                        aria-hidden
                        className="bg-status-good absolute top-1.5 -left-[1.6rem] size-3 rounded-full"
                      />
                      <p className="font-semibold tabular-nums">
                        <span className="text-success">{money(payment.amountPaise)}</span> ·{' '}
                        {t(`modes.${payment.mode}`)}
                      </p>
                      <p className="text-foreground-muted text-xs">
                        {formatDate(payment.paidAt, locale)} ·{' '}
                        {t('detail.recordedBy', { name: payment.recordedByName })}
                      </p>
                      {payment.note && (
                        <p className="text-foreground-muted text-xs">{payment.note}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          {open && can(viewer, 'sales:void') && (
            <div className="border-border rounded-lg border border-dashed p-4">
              <p className="text-foreground-muted mb-3 flex items-center gap-2 text-sm">
                <Ban aria-hidden className="size-4" />
                {t('void.hint')}
              </p>
              <CancelSaleDialog saleId={sale.id} />
            </div>
          )}
        </div>
      </div>
    </DetailFrame>
  );
}
