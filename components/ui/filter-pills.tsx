import Link from 'next/link';
import { tableHref, type QueryState } from '@/lib/table-href';
import { cn } from '@/lib/utils';

type FilterPillsProps = {
  label: string;
  param: string;
  options: { value: string | null; label: string; count?: number }[];
  basePath: string;
  query: QueryState;
};

/**
 * A one-of-many filter as links (`?status=paid`). Links rather than a select so
 * the choices are visible at a glance on a phone and work without JavaScript.
 */
export function FilterPills({ label, param, options, basePath, query }: FilterPillsProps) {
  const raw = query[param];
  const current = (Array.isArray(raw) ? raw[0] : raw) ?? null;

  return (
    <nav aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {options.map((option) => {
        const active = option.value === current;
        return (
          <Link
            key={String(option.value)}
            href={tableHref(basePath, query, { [param]: option.value })}
            scroll={false}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors sm:min-h-9',
              active
                ? 'border-action bg-action-subtle text-action font-medium'
                : 'border-border-strong bg-surface text-foreground-muted hover:text-foreground',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="bg-surface-muted text-foreground-muted rounded-full px-1.5 text-xs tabular-nums">
                {option.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
