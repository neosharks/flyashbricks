'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { tableHref } from '@/lib/table-href';
import { cn } from '@/lib/utils';

const PRESETS = ['week', 'month', 'lastMonth', 'last30', 'year'] as const;

/**
 * Period presets plus any dates, kept in the URL with the other filters, so
 * a view like "Ajay's advances this year" is a link someone can share.
 */
export function PaymentsPeriod({
  preset,
  from,
  to,
  today,
}: {
  preset: string;
  from: string;
  to: string;
  today: string;
}) {
  const t = useTranslations('staff.payments');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = Object.fromEntries(searchParams.entries());
  const [customFrom, setFrom] = useState(from);
  const [customTo, setTo] = useState(to);

  return (
    <div className="flex flex-col gap-2">
      <nav aria-label={t('periodLabel')} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {PRESETS.map((option) => {
          const active = preset === option;
          return (
            <Link
              key={option}
              href={tableHref(pathname, current, {
                period: option === 'month' ? null : option,
                from: null,
                to: null,
              })}
              scroll={false}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-full border px-3 text-sm whitespace-nowrap sm:min-h-9',
                active
                  ? 'border-action bg-action-subtle text-action font-medium'
                  : 'border-border-strong bg-surface text-foreground-muted hover:text-foreground',
              )}
            >
              {t(`presets.${option}`)}
            </Link>
          );
        })}
      </nav>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(
            tableHref(pathname, current, { period: 'custom', from: customFrom, to: customTo }),
            {
              scroll: false,
            },
          );
        }}
      >
        <label className="flex flex-col gap-1 text-xs">
          {t('from')}
          <Input
            type="date"
            value={customFrom}
            max={today}
            onChange={(event) => setFrom(event.target.value)}
            className="w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          {t('to')}
          <Input
            type="date"
            value={customTo}
            max={today}
            onChange={(event) => setTo(event.target.value)}
            className="w-40"
          />
        </label>
        <Button type="submit" variant={preset === 'custom' ? 'primary' : 'outline'}>
          {t('apply')}
        </Button>
      </form>
    </div>
  );
}
