'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { tableHref } from '@/lib/table-href';
import { cn } from '@/lib/utils';
import { RANGE_PRESETS, type DayRange } from '@/features/production/range';

/**
 * Period picker: one-tap presets as links, plus a "choose dates" form for
 * anything else. All of it lives in the URL (`?range=`, `?from=`, `?to=`).
 */
export function DateRangeFilter({ range }: { range: DayRange }) {
  const t = useTranslations('production.ranges');
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = Object.fromEntries(searchParams.entries());
  const [custom, setCustom] = useState(range.preset === 'custom');
  const [from, setFrom] = useState(range.from ?? '');
  const [to, setTo] = useState(range.to ?? '');

  const pill = (active: boolean) =>
    cn(
      'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors sm:min-h-9',
      active
        ? 'border-action bg-action-subtle text-action font-medium'
        : 'border-border-strong bg-surface text-foreground-muted hover:text-foreground',
    );

  return (
    <div className="flex flex-col gap-2">
      <nav aria-label={t('label')} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {RANGE_PRESETS.filter((preset) => preset !== 'custom').map((preset) => (
          <Link
            key={preset}
            href={tableHref(pathname, current, { range: preset, from: null, to: null })}
            scroll={false}
            aria-current={range.preset === preset ? 'true' : undefined}
            className={pill(range.preset === preset)}
          >
            {t(preset)}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setCustom((value) => !value)}
          aria-expanded={custom}
          className={pill(range.preset === 'custom')}
        >
          <CalendarRange aria-hidden className="size-4" />
          {t('custom')}
        </button>
      </nav>

      {custom && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            router.push(
              tableHref(pathname, current, { range: 'custom', from: from || null, to: to || null }),
              {
                scroll: false,
              },
            );
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-medium">
            {t('from')}
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="border-border-strong bg-surface min-h-10 rounded-md border px-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            {t('to')}
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="border-border-strong bg-surface min-h-10 rounded-md border px-2 text-base"
            />
          </label>
          <Button type="submit" size="sm" className="min-h-10">
            {t('apply')}
          </Button>
        </form>
      )}
    </div>
  );
}
