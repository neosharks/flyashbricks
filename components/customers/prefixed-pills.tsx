import Link from 'next/link';
import { tableHref, type QueryState } from '@/lib/table-href';
import { cn } from '@/lib/utils';

/**
 * Filter pills for one of several tables on a page. Like `FilterPills`, but
 * changing the filter resets only this table's cursor (`<prefix>after`), so
 * paging the other table on the page is left where it was.
 */
export function PrefixedPills({
  label,
  param,
  prefix,
  options,
  basePath,
  query,
}: {
  label: string;
  param: string;
  prefix: string;
  options: { value: string | null; label: string }[];
  basePath: string;
  query: QueryState;
}) {
  const key = `${prefix}${param}`;
  const raw = query[key];
  const current = (Array.isArray(raw) ? raw[0] : raw) ?? null;

  return (
    <nav aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {options.map((option) => {
        const active = option.value === current;
        return (
          <Link
            key={option.value ?? 'all'}
            href={tableHref(basePath, query, { [key]: option.value }, prefix)}
            scroll={false}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full border px-3 text-sm whitespace-nowrap transition-colors sm:min-h-9',
              active
                ? 'border-action bg-action-subtle text-action font-medium'
                : 'border-border-strong bg-surface text-foreground-muted hover:text-foreground',
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
