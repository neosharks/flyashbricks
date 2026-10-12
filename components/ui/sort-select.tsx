'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowDownUp } from 'lucide-react';
import { tableHref } from '@/lib/table-href';
import type { SortDir } from '@/lib/table';
import { cn } from '@/lib/utils';

export type SortOption = { sort: string; dir: SortDir; label: string };

/**
 * Sorting for card lists on a phone, where there are no column headers to
 * tap. Each option is a complete order in words ("Newest first", "Highest
 * amount"), so nobody has to think about ascending and descending.
 */
export function SortSelect({
  options,
  sort,
  dir,
  prefix = '',
  className,
}: {
  options: SortOption[];
  sort: string;
  dir: SortDir;
  prefix?: string;
  className?: string;
}) {
  const t = useTranslations('common.table');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const current = `${sort}:${dir}`;

  return (
    <label className={cn('relative flex items-center', className)}>
      <span className="sr-only">{t('sortLabel')}</span>
      <ArrowDownUp
        aria-hidden
        className="text-foreground-muted pointer-events-none absolute left-3 size-4"
      />
      <select
        value={current}
        disabled={pending}
        onChange={(event) => {
          const [nextSort = sort, nextDir = dir] = event.target.value.split(':');
          startTransition(() => {
            router.replace(
              tableHref(
                pathname,
                Object.fromEntries(searchParams.entries()),
                { [`${prefix}sort`]: nextSort, [`${prefix}dir`]: nextDir },
                prefix,
              ),
              { scroll: false },
            );
          });
        }}
        className="border-border-strong bg-surface min-h-11 w-full appearance-none rounded-md border py-2 pr-3 pl-9 text-sm disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={`${option.sort}:${option.dir}`} value={`${option.sort}:${option.dir}`}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
