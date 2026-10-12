'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { tableHref } from '@/lib/table-href';
import { Spinner } from './spinner';

/**
 * Search box bound to `?q=`. Debounced so typing a name does not fire a
 * request per keystroke; Enter searches immediately.
 */
export function TableSearch({
  placeholder,
  label,
  prefix = '',
}: {
  placeholder?: string;
  label?: string;
  /** Matches the table's `parseTableParams` prefix when a page has several tables. */
  prefix?: string;
}) {
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get(`${prefix}q`) ?? '');
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function go(next: string): void {
    if (timer.current) clearTimeout(timer.current);
    const current = Object.fromEntries(searchParams.entries());
    startTransition(() => {
      router.replace(
        tableHref(pathname, current, { [`${prefix}q`]: next.trim() || null }, prefix),
        {
          scroll: false,
        },
      );
    });
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <form
      role="search"
      className="relative w-full sm:max-w-xs"
      onSubmit={(event) => {
        event.preventDefault();
        go(value);
      }}
    >
      <label className="sr-only" htmlFor={`${prefix}table-search`}>
        {label ?? t('search')}
      </label>
      <span className="text-foreground-muted pointer-events-none absolute inset-y-0 left-3 flex items-center">
        {pending ? <Spinner label={t('loading')} /> : <Search aria-hidden className="size-4" />}
      </span>
      <input
        id={`${prefix}table-search`}
        type="search"
        value={value}
        placeholder={placeholder ?? t('searchPlaceholder')}
        autoComplete="off"
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => go(next), 350);
        }}
        className="border-border-strong bg-surface placeholder:text-foreground-subtle min-h-11 w-full rounded-md border py-2 pr-10 pl-9 text-base [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue('');
            go('');
          }}
          className="text-foreground-muted hover:text-foreground absolute inset-y-0 right-1 flex w-9 items-center justify-center"
          aria-label={t('clear')}
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </form>
  );
}
