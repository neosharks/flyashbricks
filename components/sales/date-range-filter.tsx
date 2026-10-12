'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { tableHref, type QueryState } from '@/lib/table-href';
import { DATE_PRESETS } from '@/features/sales/filters';
import { cn } from '@/lib/utils';

/**
 * Date presets as links (`?range=month`) plus a custom from/to. The resolved
 * days are worked out on the server in the yard's timezone.
 */
export function DateRangeFilter({
  query,
  from,
  to,
}: {
  query: QueryState;
  from: string | null;
  to: string | null;
}) {
  const t = useTranslations('sales.range');
  const router = useRouter();
  const pathname = usePathname();
  const rawRange = Array.isArray(query.range) ? query.range[0] : query.range;
  const current = DATE_PRESETS.find((preset) => preset === rawRange) ?? null;
  const [custom, setCustom] = useState(current === 'custom');

  const pill = (active: boolean) =>
    cn(
      'inline-flex min-h-11 items-center rounded-full border px-3 text-sm whitespace-nowrap transition-colors sm:min-h-9',
      active
        ? 'border-action bg-action-subtle text-action font-medium'
        : 'border-border-strong bg-surface text-foreground-muted hover:text-foreground',
    );

  return (
    <div className="flex flex-col gap-2">
      <nav aria-label={t('label')} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Link
          href={tableHref(pathname, query, { range: null, from: null, to: null })}
          scroll={false}
          className={pill(current === null)}
          aria-current={current === null ? 'true' : undefined}
        >
          {t('all')}
        </Link>
        {DATE_PRESETS.filter((preset) => preset !== 'custom').map((preset) => (
          <Link
            key={preset}
            href={tableHref(pathname, query, { range: preset, from: null, to: null })}
            scroll={false}
            className={pill(current === preset)}
            aria-current={current === preset ? 'true' : undefined}
          >
            {t(preset)}
          </Link>
        ))}
        <button
          type="button"
          className={pill(current === 'custom' || custom)}
          aria-expanded={custom}
          onClick={() => setCustom((open) => !open)}
        >
          <CalendarRange aria-hidden className="mr-1.5 size-4" />
          {t('custom')}
        </button>
      </nav>

      {custom && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const day = (name: string) => {
              const value = data.get(name);
              return typeof value === 'string' && value !== '' ? value : null;
            };
            router.replace(
              tableHref(pathname, query, {
                range: 'custom',
                from: day('from'),
                to: day('to'),
              }),
              { scroll: false },
            );
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            {t('from')}
            <input
              type="date"
              name="from"
              defaultValue={from ?? ''}
              className="border-border-strong bg-surface min-h-11 rounded-md border px-3"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t('to')}
            <input
              type="date"
              name="to"
              defaultValue={to ?? ''}
              className="border-border-strong bg-surface min-h-11 rounded-md border px-3"
            />
          </label>
          <Button type="submit">{t('apply')}</Button>
        </form>
      )}
    </div>
  );
}
