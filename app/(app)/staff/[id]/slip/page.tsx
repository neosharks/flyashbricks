import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { Page } from '@/components/ui/page';
import { PrintButton } from '@/components/sales/print-button';
import { getOrganization } from '@/features/settings/queries';
import { parsePeriod } from '@/features/staff/period';
import { getStaff, staffPeriod } from '@/features/staff/queries';
import { amountInWords } from '@/lib/amount-in-words';
import { formatMoney } from '@/lib/money';
import { getOrgTimezone } from '@/lib/org';
import { formatPhone } from '@/lib/phone';
import { requirePermissionPage } from '@/lib/session';
import { formatDate, formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'Salary slip' };

/** Printing shows only the slip; the app around it is hidden, not rearranged. */
const PRINT_CSS = `
@page { size: A4; margin: 14mm; }
@media print {
  html, body { background: #fff !important; }
  body * { visibility: hidden; }
  #slip, #slip * { visibility: visible; }
  #slip { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; padding: 0 !important; color: #000; }
}
`;

export default async function SalarySlipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const viewer = await requirePermissionPage(`/staff/${id}/slip`, 'staff:read');
  const query = await searchParams;
  const timeZone = await getOrgTimezone(viewer.orgId);
  // Any from/to pair is treated as a chosen range; nothing given means this month.
  const period = parsePeriod(
    { ...query, period: query.from && query.to ? 'custom' : query.period },
    timeZone,
  );

  const staff = await getStaff(viewer, id, timeZone);
  if (!staff) notFound();

  const [t, locale, org, summary] = await Promise.all([
    getTranslations('staff'),
    getLocale(),
    getOrganization(viewer),
    staffPeriod(viewer, staff, { from: period.from, to: period.to }, timeZone),
  ]);
  const money = (paise: number) => formatMoney(paise, locale);
  const day = (key: string) => formatDate(`${key}T00:00:00Z`, locale, 'UTC');
  const basic = summary.earnedPaise;
  const net = summary.balancePaise;

  return (
    <Page size="compact">
      <style>{PRINT_CSS}</style>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link
          href={`/staff/${staff.id}`}
          className="text-foreground-muted hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {t('slip.back')}
        </Link>
        <PrintButton label={t('slip.print')} />
      </div>

      <article
        id="slip"
        className="border-border mx-auto max-w-[210mm] rounded-lg border bg-white p-6 text-[13px] leading-snug text-neutral-900 shadow-sm sm:p-10"
      >
        <header className="flex flex-col gap-1 border-b border-neutral-300 pb-4 sm:flex-row sm:justify-between">
          <div>
            <p className="text-lg font-bold">{org?.legalName ?? org?.name}</p>
            {org?.address && (
              <p>{[org.address, org.city, org.pincode].filter(Boolean).join(', ')}</p>
            )}
            {org?.phone && <p>{formatPhone(org.phone)}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-base font-bold tracking-wide uppercase">{t('slip.title')}</p>
            <p>
              {t('slip.period')}: {day(period.from)} – {day(period.to)}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-1 border-b border-neutral-300 py-4 sm:grid-cols-2">
          <p>
            <span className="text-neutral-500">{t('slip.employee')}: </span>
            <span className="font-semibold">{staff.name}</span>
            {staff.nameHi && <span lang="hi"> ({staff.nameHi})</span>}
          </p>
          <p>
            <span className="text-neutral-500">{t('form.role')}: </span>
            {t(`roles.${staff.role}`)}
          </p>
          <p>
            <span className="text-neutral-500">{t('form.wageType')}: </span>
            {t(`rate.${staff.wageType}`, { amount: money(staff.wageRatePaise) })}
          </p>
          {staff.phone && (
            <p>
              <span className="text-neutral-500">{t('form.phone')}: </span>
              {formatPhone(staff.phone)}
            </p>
          )}
        </section>

        <section className="border-b border-neutral-300 py-4">
          <p className="mb-2 font-semibold">{t('slip.work')}</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
            {(['present', 'half_day', 'absent', 'leave', 'holiday'] as const).map((status) => (
              <div key={status} className="flex justify-between">
                <dt className="text-neutral-500">{t(`status.${status}`)}</dt>
                <dd className="tabular-nums">{summary.counts[status]}</dd>
              </div>
            ))}
            <div className="flex justify-between">
              <dt className="text-neutral-500">{t('detail.overtimeHours')}</dt>
              <dd className="tabular-nums">
                {formatNumber(Math.round((summary.counts.overtimeMinutes / 60) * 10) / 10, locale)}
              </dd>
            </div>
            {staff.wageType === 'per_thousand_bricks' && (
              <div className="flex justify-between">
                <dt className="text-neutral-500">{t('detail.bricks')}</dt>
                <dd className="tabular-nums">{formatNumber(summary.counts.bricks, locale)}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="grid grid-cols-1 gap-6 py-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 font-semibold">{t('slip.earnings')}</p>
            <dl className="flex flex-col gap-1">
              <div className="flex justify-between">
                <dt>{t('slip.basic')}</dt>
                <dd className="tabular-nums">{money(basic)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t('slip.bonus')}</dt>
                <dd className="tabular-nums">{money(summary.payments.bonus)}</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="mb-2 font-semibold">{t('slip.deductionsTitle')}</p>
            <dl className="flex flex-col gap-1">
              <div className="flex justify-between">
                <dt>{t('slip.wagesPaid')}</dt>
                <dd className="tabular-nums">{money(summary.payments.wage)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t('slip.advances')}</dt>
                <dd className="tabular-nums">{money(summary.payments.advance)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t('slip.deductions')}</dt>
                <dd className="tabular-nums">{money(summary.payments.deduction)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="flex flex-col gap-1 border-y-2 border-neutral-800 py-3">
          <div className="flex justify-between text-base font-bold">
            <span>{t('slip.net')}</span>
            <span className="tabular-nums">{money(net)}</span>
          </div>
          <p>
            <span className="text-neutral-500">{t('slip.inWords')}: </span>
            {net < 0 ? '−' : ''}
            {amountInWords(Math.abs(net), locale === 'hi' ? 'hi' : 'en')}
          </p>
        </section>

        <footer className="mt-16 grid grid-cols-2 gap-8">
          <p className="border-t border-neutral-400 pt-1 text-center text-neutral-600">
            {t('slip.employeeSignature')}
          </p>
          <p className="border-t border-neutral-400 pt-1 text-center text-neutral-600">
            {t('slip.signature')} · {org?.name}
          </p>
        </footer>
      </article>
    </Page>
  );
}
