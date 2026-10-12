'use client';

import { useTranslations } from 'next-intl';
import { KeyRound } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';

/**
 * Backup password + confirmation, shared by the download and email forms.
 * Called a "password" on screen; it is the passphrase the file is locked with.
 */
export function PassphraseFields({
  error,
  disabled = false,
}: {
  error: (field: string) => string | undefined;
  disabled?: boolean;
}) {
  const t = useTranslations('backup');
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('password')} hint={t('passwordHint')} required error={error('passphrase')}>
          {(props) => (
            <PasswordInput
              {...props}
              name="passphrase"
              autoComplete="new-password"
              minLength={16}
              disabled={disabled}
              required={!disabled}
            />
          )}
        </Field>
        <Field label={t('confirmPassword')} required error={error('confirmPassphrase')}>
          {(props) => (
            <PasswordInput
              {...props}
              name="confirmPassphrase"
              autoComplete="new-password"
              disabled={disabled}
              required={!disabled}
            />
          )}
        </Field>
      </div>
      {!disabled && (
        <p className="bg-warning-subtle text-foreground flex gap-2 rounded-md px-3 py-2 text-sm font-medium">
          <KeyRound aria-hidden className="text-warning mt-0.5 size-4 shrink-0" />
          {t('keepSafe')}
        </p>
      )}
    </div>
  );
}
