import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Download, FileText, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Page } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/data-table';
import { PeriodFilter } from '@/components/staff/period-filter';
import { StaffPaymentDialog } from '@/components/staff/staff-payment-dialog';
import { StaffTabs } from '@/components/staff/staff-tabs';
import { parsePeriod } from '@/features/staff/period';
import { payroll } from '@/features/staff/queries';
import type { PayrollRow } from '@/features/staff/types';
import { pickText } from '@/lib/bilingual';
import { todayKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { getOrgTimezone } from '@/lib/org';
import { can } from '@/lib/permissions';
import { requirePermissionPage } from '@/lib/session';
import { cn, formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'Wages' };

type SearchParams = Record<string, string | string[] | undefined>;

function totalsOf(rows: PayrollRow[]) {
  return rows.reduce(
    (sum, row) => ({
      earned: sum.earned + row.earnedPaise,
      bonus: sum.bonus + row.payments.bonus,
      taken: sum.taken + row.payments.advance + row.payments.deduction,
      paid: sum.paid + row.payments.wage,
      balance: sum.balance + row.balancePaise,
    }),
    { earned: 0, bonus: 0, taken: 0, paid: 0, balance: 0 },
  );
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermissionPage('/staff/payroll', 'staff:read');
  const query = await searchParams;
  const timeZone = await getOrgTimezone(viewer.orgId);
  const today = todayKey(timeZone);
  const period = parsePeriod(query, timeZone);
  const canWrite = can(viewer, 'staff:write');

  const [t, locale, rows] = await Promise.all([
    getTranslations('staff'),
    getLocale(),
    payroll(viewer, { from: period.from, to: period.to }, timeZone),
  ]);
  const money = (paise: number) => formatMoney(paise, locale);
  const totals = totalsOf(rows);
  const range = `from=${period.from}&to=${period.to}`;
  const exportHref = `/api/export/staff-payroll?period=custom&${range}`;

  return (
    <Page>
      <PageHeader
        title={t('payroll.title')}
        description={t('payroll.description')}
        actions={
          rows.length > 0 && (
            <Button asChild variant="outline">
              <a href={exportHref} download>
                <Download aria-hidden />
                {t('payroll.export')}
              </a>
            </Button>
          )
        }
      />
      <StaffTabs current="payroll" />
      <div className="mb-4">
        <PeriodFilter period={period} today={today} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Wallet} title={t('payroll.empty')} description={t('emptyBody')} />
      ) : (
        <>
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((row) => {
              const name = pickText(row.name, row.nameHi, locale);
              return (
                <li key={row.id} className="border-border bg-surface rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/staff/${row.id}`} className="min-w-0">
                      <p className="truncate font-medium">{name}</p>
                      <p className="text-foreground-muted text-xs">
                        {t('payroll.daysValue', {
                          present: row.counts.present,
                          half: row.counts.half_day,
                        })}
                      </p>
                    </Link>
                    <p
                      className={cn(
                        'text-lg font-semibold tabular-nums',
                        row.balancePaise > 0 ? 'text-danger' : '',
                      )}
                    >
                      {money(row.balancePaise)}
                    </p>
                  </div>
                  <dl className="text-foreground-muted mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt>{t('payroll.columns.earned')}</dt>
                      <dd className="text-foreground tabular-nums">{money(row.earnedPaise)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>{t('payroll.columns.paid')}</dt>
                      <dd
                        className={cn(
                          'tabular-nums',
                          row.payments.wage > 0 ? 'text-success' : 'text-foreground',
                        )}
                      >
                        {money(row.payments.wage)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>{t('payroll.columns.advances')}</dt>
                      <dd
                        className={cn(
                          'tabular-nums',
                          row.payments.advance + row.payments.deduction > 0
                            ? 'text-danger'
                            : 'text-foreground',
                        )}
                      >
                        {money(row.payments.advance + row.payments.deduction)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>{t('payroll.columns.bonus')}</dt>
                      <dd
                        className={cn(
                          'tabular-nums',
                          row.payments.bonus > 0 ? 'text-success' : 'text-foreground',
                        )}
                      >
                        {money(row.payments.bonus)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex gap-2">
                    {canWrite && row.balancePaise > 0 && (
                      <StaffPaymentDialog
                        staffId={row.id}
                        name={name}
                        type="wage"
                        owedPaise={row.balancePaise}
                        today={today}
                        period={{ from: period.from, to: period.to }}
                        variant="primary"
                        size="sm"
                        label={t('payroll.pay')}
                      />
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/staff/${row.id}/slip?${range}`}>
                        <FileText aria-hidden />
                        {t('payroll.slip')}
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          <Table caption={t('payroll.title')} minWidth="60rem" className="hidden md:block">
            <THead>
              <TH>{t('payroll.columns.name')}</TH>
              <TH align="right">{t('payroll.columns.days')}</TH>
              <TH align="right">{t('payroll.columns.earned')}</TH>
              <TH align="right">{t('payroll.columns.bonus')}</TH>
              <TH align="right">{t('payroll.columns.advances')}</TH>
              <TH align="right">{t('payroll.columns.paid')}</TH>
              <TH align="right">{t('payroll.columns.balance')}</TH>
              <TH>
                <span className="sr-only">{t('payroll.columns.actions')}</span>
              </TH>
            </THead>
            <TBody>
              {rows.map((row) => {
                const name = pickText(row.name, row.nameHi, locale);
                return (
                  <TR key={row.id} className={cn(!row.isActive && 'opacity-70')}>
                    <TD>
                      <Link href={`/staff/${row.id}`} className="hover:text-action font-medium">
                        {name}
                      </Link>
                      <span className="text-foreground-muted block text-xs">
                        {t(`roles.${row.role}`)}
                      </span>
                    </TD>
                    <TD align="right">
                      {t('payroll.daysValue', {
                        present: row.counts.present,
                        half: row.counts.half_day,
                      })}
                    </TD>
                    <TD align="right">{money(row.earnedPaise)}</TD>
                    <TD align="right" className={cn(row.payments.bonus > 0 && 'text-success')}>
                      {money(row.payments.bonus)}
                    </TD>
                    <TD
                      align="right"
                      className={cn(
                        row.payments.advance + row.payments.deduction > 0 && 'text-danger',
                      )}
                    >
                      {money(row.payments.advance + row.payments.deduction)}
                    </TD>
                    <TD align="right" className={cn(row.payments.wage > 0 && 'text-success')}>
                      {money(row.payments.wage)}
                    </TD>
                    <TD
                      align="right"
                      className={cn('font-semibold', row.balancePaise > 0 && 'text-danger')}
                    >
                      {money(row.balancePaise)}
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        {canWrite && row.balancePaise > 0 && (
                          <StaffPaymentDialog
                            staffId={row.id}
                            name={name}
                            type="wage"
                            owedPaise={row.balancePaise}
                            today={today}
                            period={{ from: period.from, to: period.to }}
                            size="sm"
                            label={t('payroll.pay')}
                          />
                        )}
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/staff/${row.id}/slip?${range}`}>{t('payroll.slip')}</Link>
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
            <tfoot className="border-border bg-surface-muted border-t font-semibold">
              <tr>
                <th scope="row" className="px-3 py-3 text-left">
                  {formatNumber(rows.length, locale)}
                </th>
                <td />
                <td className="px-3 py-3 text-right tabular-nums">{money(totals.earned)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(totals.bonus)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(totals.taken)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(totals.paid)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(totals.balance)}</td>
                <td />
              </tr>
            </tfoot>
          </Table>
        </>
      )}
    </Page>
  );
}
