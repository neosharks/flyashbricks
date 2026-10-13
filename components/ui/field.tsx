'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type FieldProps = {
  label: string;
  /** Rendered under the control, before any error, so the format is known in advance. */
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  className?: string | undefined;
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean | undefined;
  }) => React.ReactNode;
};

/**
 * Wires the label, hint and error to the control with real ids, so a screen
 * reader announces the field name, its format, and what went wrong.
 *
 * Spacing is margins rather than a gap: the error's live region is always
 * there (a region added together with its text is often not announced) and
 * must take no room while it is empty.
 */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const t = useTranslations('common');
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn('flex flex-col', className)}>
      <label
        htmlFor={id}
        // Read by the error summary, which names a field without "(optional)".
        data-label={label}
        className={cn('mb-1.5 text-sm font-medium', error ? 'text-danger' : 'text-foreground')}
      >
        {label}
        {!required && (
          <span className="text-foreground-muted ml-1 font-normal">({t('optional')})</span>
        )}
      </label>

      {children({
        id,
        'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? true : undefined,
      })}

      {hint && (
        <p id={hintId} className="text-foreground-muted mt-1.5 text-xs">
          {hint}
        </p>
      )}

      <div aria-live="polite">{error && <FieldError id={errorId}>{error}</FieldError>}</div>
    </div>
  );
}

/**
 * Radio buttons under one question. The error belongs to the group (ARIA
 * allows `aria-invalid` on a radio group, not on a single radio), and the
 * group is named by the legend.
 */
export function Fieldset({
  legend,
  hint,
  error,
  required,
  className,
  children,
}: Omit<FieldProps, 'label' | 'children'> & {
  legend: string;
  children: React.ReactNode;
}) {
  const t = useTranslations('common');
  const id = useId();
  const legendId = `${id}-legend`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <fieldset className={className}>
      <legend
        id={legendId}
        data-label={legend}
        className={cn('mb-2 text-sm font-medium', error ? 'text-danger' : 'text-foreground')}
      >
        {legend}
        {!required && (
          <span className="text-foreground-muted ml-1 font-normal">({t('optional')})</span>
        )}
      </legend>

      <div
        role="radiogroup"
        aria-labelledby={legendId}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? true : undefined}
        className={cn(
          'rounded-lg',
          error && 'ring-danger ring-offset-surface ring-2 ring-offset-2',
        )}
      >
        {children}
      </div>

      {hint && (
        <p id={hintId} className="text-foreground-muted mt-1.5 text-xs">
          {hint}
        </p>
      )}

      <div aria-live="polite">{error && <FieldError id={errorId}>{error}</FieldError>}</div>
    </fieldset>
  );
}

/** An error under a control. The icon is decoration; the words carry the meaning. */
export function FieldError({
  id,
  children,
}: {
  id?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <p id={id} className="text-danger mt-1.5 flex items-start gap-1.5 text-xs font-medium">
      <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
