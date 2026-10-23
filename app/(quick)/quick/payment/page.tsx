import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { QuickPayment } from '@/components/quick/quick-payment';
import { TaskFrame } from '@/components/quick/task-frame';
import { getCustomer, listCustomers } from '@/features/customers/queries';
import { getSale, listSales } from '@/features/sales/queries';
import { todayKey } from '@/lib/dates';
import { formatSaleNumber } from '@/lib/ids';
import { formatMoney } from '@/lib/money';
import { getOrgTimezone } from '@/lib/org';
import { formatPhone } from '@/lib/phone';
import { requirePermissionPage } from '@/lib/session';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Payment received' };

const STEPS = 3;
const OBJECT_ID = /^[a-f\d]{24}$/i;
const row =
  'border-border-strong bg-surface hover:bg-surface-muted flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3';

/**
 * "Money received": whose money, against which bill, how much. The first two
 * steps are plain links, so the lists come straight from the server.
 */
export default async function QuickPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; customer?: string; sale?: string }>;
}) {
  const user = await requirePermissionPage('/quick/payment', 'sales:write');
  const params = await searchParams;
  const [t, locale, timezone] = await Promise.all([
    getTranslations('quick'),
    getLocale(),
    getOrgTimezone(user.orgId),
  ]);
  const title = t('tasks.payment.title');
  const money = (paise: number) => formatMoney(paise, locale);

  if (params.sale && OBJECT_ID.test(params.sale)) {
    const sale = await getSale(user, params.sale);
    // A bill paid off right here stays on screen: the page refreshes after saving.
    if (!sale || sale.voided) redirect('/quick/payment');
    return (
      <QuickPayment
        title={title}
        steps={STEPS}
        backHref={`/quick/payment?customer=${sale.customerId}`}
        today={todayKey(timezone)}
        sale={{
          id: sale.id,
          label: formatSaleNumber(sale.number),
          customerName: sale.customerName,
          duePaise: sale.duePaise,
        }}
      />
    );
  }

  if (params.customer && OBJECT_ID.test(params.customer)) {
    const [customer, bills] = await Promise.all([
      getCustomer(user, params.customer),
      listSales(
        user,
        { q: '', sort: 'date', dir: 'asc', after: null, before: null, size: 30 },
        {
          range: null,
          from: null,
          to: null,
          status: 'due',
          customerId: params.customer,
          productId: null,
          rateBand: null,
        },
        timezone,
      ),
    ]);
    if (!customer) redirect('/quick/payment');
    // One open bill: nothing to choose.
    if (bills.rows.length === 1 && bills.rows[0]) {
      redirect(`/quick/payment?sale=${bills.rows[0].id}`);
    }
    return (
      <TaskFrame
        title={title}
        step={1}
        steps={STEPS}
        question={t('payment.whichBill', { name: customer.name })}
        backHref="/quick/payment"
      >
        <p className="text-foreground-muted">
          {t('payment.owesTotal', { amount: money(customer.duePaise) })}
        </p>
        {bills.rows.length === 0 && <p>{t('payment.noBills')}</p>}
        {bills.rows.map((bill) => (
          <Link key={bill.id} href={`/quick/payment?sale=${bill.id}`} className={row}>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold">
                {formatSaleNumber(bill.number)} · {formatDate(bill.date, locale)}
              </span>
              <span className="text-foreground-muted block truncate text-sm">
                {bill.itemsSummary}
              </span>
            </span>
            <span className="text-danger font-semibold tabular-nums">{money(bill.duePaise)}</span>
            <ChevronRight aria-hidden className="text-foreground-subtle size-5 shrink-0" />
          </Link>
        ))}
      </TaskFrame>
    );
  }

  const q = (params.q ?? '').trim().slice(0, 80);
  const customers = await listCustomers(user, {
    q,
    sort: 'duePaise',
    dir: 'desc',
    after: null,
    before: null,
    size: 30,
    dues: true,
  });

  return (
    <TaskFrame title={title} step={0} steps={STEPS} question={t('payment.who')}>
      <form method="get" role="search" className="relative">
        <span className="text-foreground-muted pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <Search aria-hidden className="size-5" />
        </span>
        <Input
          type="search"
          name="q"
          defaultValue={q}
          aria-label={t('sale.search')}
          placeholder={t('sale.search')}
          autoComplete="off"
          className="min-h-14 pl-10 text-lg"
        />
      </form>
      {customers.rows.length === 0 && (
        <p className="text-foreground-muted">{q ? t('sale.noMatches') : t('payment.nobodyOwes')}</p>
      )}
      {customers.rows.map((customer) => (
        <Link key={customer.id} href={`/quick/payment?customer=${customer.id}`} className={row}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-semibold">{customer.name}</span>
            <span className="text-foreground-muted block text-sm tabular-nums">
              {customer.phones[0] ? formatPhone(customer.phones[0]) : ''}
              {customer.city ? ` · ${customer.city}` : ''}
            </span>
          </span>
          <span className="text-danger font-semibold tabular-nums">{money(customer.duePaise)}</span>
          <ChevronRight aria-hidden className="text-foreground-subtle size-5 shrink-0" />
        </Link>
      ))}
    </TaskFrame>
  );
}
