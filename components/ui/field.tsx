'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
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
 */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const t = useTranslations('common');
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-foreground text-sm font-medium">
        {label}
        {!required && (
          <span className="text-foreground-muted ml-1 font-normal">({t('optional')})</span>
        )}
      </label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}

      {hint && (
        <p id={hintId} className="text-foreground-muted text-xs">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-danger text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
