'use client';

import { useTranslations } from 'next-intl';
import type { FieldErrorItem } from '@/hooks/use-action-form';
import { revealField } from '@/lib/form-fields';
import { Alert } from './alert';

/**
 * The top of every form: what went wrong overall, and a list of every field
 * that needs fixing, each one a jump to its box. Every field error is listed,
 * including one for a field this form has no box for, so nothing the server
 * says is ever silently dropped.
 */
export function FormErrors({
  form,
}: {
  form: { formError: string | null; fieldErrors: FieldErrorItem[] };
}) {
  const t = useTranslations('common.formErrors');
  const { formError, fieldErrors } = form;
  if (!formError && fieldErrors.length === 0) return null;

  return (
    // Focused after a failed submit when no field can be.
    <div data-form-errors tabIndex={-1} className="flex flex-col gap-3 outline-none">
      {formError && <Alert tone="danger">{formError}</Alert>}
      {fieldErrors.length > 0 && (
        <Alert tone="danger" title={t('title', { count: fieldErrors.length })}>
          <ul className="mt-1 flex flex-col gap-1">
            {fieldErrors.map(({ field, message, target }) => {
              const text = target?.label ? (
                <>
                  <span className="font-medium">{target.label}</span>: {message}
                </>
              ) : (
                message
              );
              return (
                <li key={field}>
                  {target ? (
                    <button
                      type="button"
                      className="min-h-6 text-left underline underline-offset-2 hover:no-underline"
                      onClick={(event) => revealField(event.currentTarget.closest('form'), field)}
                    >
                      {text}
                    </button>
                  ) : (
                    text
                  )}
                </li>
              );
            })}
          </ul>
        </Alert>
      )}
    </div>
  );
}
