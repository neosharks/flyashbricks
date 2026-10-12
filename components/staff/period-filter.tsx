'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Period } from '@/features/staff/period';
import { cn } from '@/lib/utils';

/** This month, last month, or any dates — kept in the URL so the view can be shared. */
export function PeriodFilter({ period, today }: { period: Period; today: string }) {
  const t = useTranslations('staff.payroll');
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);

  const pill = (active: boolean) =>
    cn(
      'inline-flex min-h-11 items-center rounded-full border px-3 text-sm whitespace-nowrap sm:min-h-9',
      active
        ? 'border-action bg-action-subtle text-action font-medium'
        : 'border-border-strong bg-surface text-foreground-muted hover:text-foreground',
    );

  return (
    <div className="flex flex-col gap-2">
      <nav aria-label={t('period')} className="flex flex-wrap gap-1.5">
        <Link
          href={pathname}
          className={pill(period.preset === 'month')}
          aria-current={period.preset === 'month' ? 'true' : undefined}
        >
          {t('thisMonth')}
        </Link>
        <Link
          href={`${pathname}?period=lastMonth`}
          className={pill(period.preset === 'lastMonth')}
          aria-current={period.preset === 'lastMonth' ? 'true' : undefined}
        >
          {t('lastMonth')}
        </Link>
      </nav>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(`${pathname}?period=custom&from=${from}&to=${to}`);
        }}
      >
        <label className="flex flex-col gap-1 text-xs">
          {t('from')}
          <Input
            type="date"
            value={from}
            max={today}
            onChange={(event) => setFrom(event.target.value)}
            className="w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          {t('to')}
          <Input
            type="date"
            value={to}
            max={today}
            onChange={(event) => setTo(event.target.value)}
            className="w-40"
          />
        </label>
        <Button type="submit" variant={period.preset === 'custom' ? 'primary' : 'outline'}>
          {t('apply')}
        </Button>
      </form>
    </div>
  );
}
