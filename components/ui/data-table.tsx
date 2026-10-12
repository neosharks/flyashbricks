import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import { tableHref, type QueryState } from '@/lib/table-href';
import type { SortDir } from '@/lib/table';
import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';

/**
 * Server-rendered table pieces. Sorting and paging are plain links, so they
 * work before any JavaScript loads and every view has a shareable URL.
 *
 * On a phone the table scrolls sideways inside its card rather than squeezing
 * columns; the first column stays pinned so a row is always identifiable.
 */
export function Table({
  caption,
  children,
  className,
  minWidth = '40rem',
}: {
  caption: string;
  children: React.ReactNode;
  className?: string;
  minWidth?: string;
}) {
  return (
    <div className={cn('border-border bg-surface overflow-x-auto rounded-lg border', className)}>
      <table className="w-full text-sm" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-surface-muted text-foreground-muted border-border border-b text-left text-xs font-medium tracking-wide uppercase">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  align = 'left',
  className,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        'px-3 py-2.5 font-medium whitespace-nowrap',
        align === 'right' && 'text-right',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-border divide-y">{children}</tbody>;
}

export function TR({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={cn('hover:bg-surface-muted/60 transition-colors', className)}>{children}</tr>
  );
}

export function TD({
  children,
  align = 'left',
  className,
  muted = false,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  muted?: boolean;
}) {
  return (
    <td
      className={cn(
        'px-3 py-3 align-middle',
        align === 'right' && 'text-right tabular-nums',
        muted && 'text-foreground-muted',
        className,
      )}
    >
      {children}
    </td>
  );
}

/** A column header that sorts by `column`; a second click reverses the order. */
export async function SortableTH({
  column,
  label,
  sort,
  dir,
  basePath,
  query,
  align = 'left',
  defaultDir = 'asc',
  prefix = '',
}: {
  prefix?: string;
  column: string;
  label: string;
  sort: string;
  dir: SortDir;
  basePath: string;
  query: QueryState;
  align?: 'left' | 'right';
  /** Numbers and dates usually read best biggest/newest first. */
  defaultDir?: SortDir;
}) {
  const t = await getTranslations('common.table');
  const active = sort === column;
  const nextDir: SortDir = active ? (dir === 'asc' ? 'desc' : 'asc') : defaultDir;
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-3 py-2.5 font-medium whitespace-nowrap', align === 'right' && 'text-right')}
    >
      <Link
        href={tableHref(
          basePath,
          query,
          { [`${prefix}sort`]: column, [`${prefix}dir`]: nextDir },
          prefix,
        )}
        scroll={false}
        className={cn(
          'hover:text-foreground inline-flex items-center gap-1 rounded uppercase',
          active && 'text-foreground',
          align === 'right' && 'flex-row-reverse',
        )}
        aria-label={t('sortBy', { column: label })}
      >
        {label}
        <Icon aria-hidden className={cn('size-3.5', !active && 'opacity-40')} />
        {active && (
          <span className="sr-only">
            {dir === 'asc' ? t('sortedAscending') : t('sortedDescending')}
          </span>
        )}
      </Link>
    </th>
  );
}

export async function Pagination({
  basePath,
  query,
  next,
  prev,
  count,
  prefix = '',
}: {
  basePath: string;
  query: QueryState;
  next: string | null;
  prev: string | null;
  count: number;
  /** Matches the table's `parseTableParams` prefix when a page has several tables. */
  prefix?: string;
}) {
  const t = await getTranslations('common.table');
  if (!next && !prev) {
    return <p className="text-foreground-muted mt-3 text-xs">{t('showing', { count })}</p>;
  }

  const linkClass =
    'border-border-strong bg-surface hover:bg-surface-muted inline-flex min-h-10 items-center gap-1 rounded-md border px-3 text-sm font-medium';
  const disabledClass =
    'border-border text-foreground-subtle inline-flex min-h-10 items-center gap-1 rounded-md border px-3 text-sm';

  return (
    <nav aria-label={t('pagination')} className="mt-3 flex items-center justify-between gap-3">
      <p className="text-foreground-muted text-xs">{t('showing', { count })}</p>
      <div className="flex gap-2">
        {prev ? (
          <Link
            href={tableHref(basePath, query, { [`${prefix}before`]: prev }, prefix)}
            scroll={false}
            className={linkClass}
          >
            <ChevronLeft aria-hidden className="size-4" />
            {t('previous')}
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled>
            <ChevronLeft aria-hidden className="size-4" />
            {t('previous')}
          </span>
        )}
        {next ? (
          <Link
            href={tableHref(basePath, query, { [`${prefix}after`]: next }, prefix)}
            scroll={false}
            className={linkClass}
          >
            {t('next')}
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled>
            {t('next')}
            <ChevronRight aria-hidden className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}

export async function NoResults({ action }: { action?: React.ReactNode }) {
  const t = await getTranslations('common.table');
  return (
    <EmptyState
      icon={SearchX}
      title={t('noResults')}
      description={t('noResultsHint')}
      action={action}
    />
  );
}
