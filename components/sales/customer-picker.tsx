'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Search, UserPlus, Users } from 'lucide-react';
import { BilingualInput } from '@/components/ui/bilingual-input';
import { Field, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Spinner } from '@/components/ui/spinner';
import { searchCustomersAction } from '@/features/customers/actions';
import type { CustomerOption } from '@/features/customers/types';
import { formatMoney } from '@/lib/money';
import { formatPhone } from '@/lib/phone';
import { cn } from '@/lib/utils';

type Mode = 'existing' | 'new';

/**
 * Step 1 of a sale: find the buyer by name or phone, or add them right here.
 * Recent buyers show before anything is typed, so a regular is one tap.
 */
export function CustomerPicker({
  initial,
  error,
  onChange,
}: {
  initial: CustomerOption | null;
  error: (field: string) => string | undefined;
  onChange: (customer: CustomerOption | null, mode: Mode) => void;
}) {
  const t = useTranslations('sales.form');
  const locale = useLocale();
  const [mode, setMode] = useState<Mode>('existing');
  const [selected, setSelected] = useState<CustomerOption | null>(initial);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changed = useRef(onChange);
  const errorId = useId();
  const customerError = error('customerId');

  useEffect(() => {
    changed.current = onChange;
  });

  function search(text: string): void {
    startTransition(async () => {
      const result = await searchCustomersAction(text);
      if (result.ok) setResults(result.data);
    });
  }

  // Recent customers as soon as the picker opens.
  useEffect(() => {
    if (mode !== 'existing' || selected) return;
    startTransition(async () => {
      const result = await searchCustomersAction('');
      if (result.ok) setResults(result.data);
    });
  }, [mode, selected]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const tab = (active: boolean) =>
    cn(
      'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors',
      active
        ? 'bg-surface text-foreground shadow-xs'
        : 'text-foreground-muted hover:text-foreground',
    );

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="customerMode" value={mode} />
      <input
        type="hidden"
        name="customerId"
        value={mode === 'existing' ? (selected?.id ?? '') : ''}
      />

      <div role="tablist" className="bg-surface-muted flex gap-1 rounded-lg p-1">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'existing'}
          className={tab(mode === 'existing')}
          onClick={() => {
            setMode('existing');
            changed.current(selected, 'existing');
          }}
        >
          <Users aria-hidden className="size-4" />
          {t('existing')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'new'}
          className={tab(mode === 'new')}
          onClick={() => {
            setMode('new');
            changed.current(null, 'new');
          }}
        >
          <UserPlus aria-hidden className="size-4" />
          {t('newCustomer')}
        </button>
      </div>

      {mode === 'existing' ? (
        selected ? (
          <div className="border-action bg-action-subtle flex items-center gap-3 rounded-lg border p-3">
            <Check aria-hidden className="text-action size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{selected.name}</p>
              <p className="text-foreground-muted text-sm tabular-nums">
                {formatPhone(selected.phone)}
                {selected.city ? ` · ${selected.city}` : ''}
              </p>
              {selected.duePaise > 0 && (
                <p className="text-danger text-sm font-medium">
                  {t('owes', { amount: formatMoney(selected.duePaise, locale) })}
                </p>
              )}
            </div>
            <button
              type="button"
              className="text-action min-h-11 px-2 text-sm font-medium"
              onClick={() => {
                setSelected(null);
                changed.current(null, 'existing');
              }}
            >
              {t('change')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <span className="text-foreground-muted pointer-events-none absolute inset-y-0 left-3 flex items-center">
                {pending ? (
                  <Spinner label={t('searching')} />
                ) : (
                  <Search aria-hidden className="size-4" />
                )}
              </span>
              <Input
                type="search"
                // The chosen customer posts from a hidden field; this is where it is chosen.
                data-error-key="customerId"
                aria-invalid={customerError ? true : undefined}
                aria-describedby={customerError ? errorId : undefined}
                aria-label={t('searchCustomer')}
                placeholder={t('searchCustomer')}
                value={query}
                autoComplete="off"
                className="pl-9"
                onChange={(event) => {
                  const text = event.target.value;
                  setQuery(text);
                  if (timer.current) clearTimeout(timer.current);
                  timer.current = setTimeout(() => search(text), 300);
                }}
              />
            </div>
            {results.length === 0 && query && !pending ? (
              <p className="text-foreground-muted text-sm">{t('noMatches')}</p>
            ) : (
              <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
                {results.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      className="hover:bg-surface-muted flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left"
                      onClick={() => {
                        setSelected(customer);
                        changed.current(customer, 'existing');
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{customer.name}</span>
                        <span className="text-foreground-muted block text-sm tabular-nums">
                          {formatPhone(customer.phone)}
                          {customer.city ? ` · ${customer.city}` : ''}
                        </span>
                      </span>
                      {customer.duePaise > 0 && (
                        <span className="text-danger text-sm font-medium tabular-nums">
                          {formatMoney(customer.duePaise, locale)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {customerError && <FieldError id={errorId}>{customerError}</FieldError>}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <BilingualInput
            label={t('customerName')}
            name="newCustomerName"
            required
            maxLength={120}
            errors={{ en: error('newCustomerName'), hi: error('newCustomerNameHi') }}
          />
          <Field label={t('customerPhone')} required error={error('newCustomerPhone')}>
            {(props) => (
              <PhoneInput
                {...props}
                name="newCustomerPhone"
                placeholder={t('phonePlaceholder')}
                required
              />
            )}
          </Field>
        </div>
      )}
    </div>
  );
}
