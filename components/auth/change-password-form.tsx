'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { FormErrors } from '@/components/ui/form-errors';
import { Field } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { changePassword } from '@/features/auth/actions';
import { ChangePasswordSchema } from '@/features/auth/schema';
import { useActionForm } from '@/hooks/use-action-form';

/** Used both for the forced first-time password and for changing it later. */
export function ChangePasswordForm({
  temporary,
  redirectTo,
}: {
  temporary: boolean;
  redirectTo?: string;
}) {
  const t = useTranslations('auth');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const form = useActionForm(
    changePassword,
    () => {
      toast.success(t('passwordChanged'));
      formRef.current?.reset();
      if (redirectTo) router.replace(redirectTo);
      router.refresh();
    },
    { schema: ChangePasswordSchema },
  );

  return (
    <form
      ref={formRef}
      method="post"
      onSubmit={form.onSubmit}
      onChange={form.onChange}
      onBlur={form.onBlur}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormErrors form={form} />

      <Field
        label={temporary ? t('temporaryPassword') : t('currentPassword')}
        required
        error={form.error('currentPassword')}
      >
        {(props) => (
          <PasswordInput
            {...props}
            name="currentPassword"
            autoComplete="current-password"
            required
          />
        )}
      </Field>

      <Field
        label={t('newPassword')}
        hint={t('passwordHint')}
        required
        error={form.error('newPassword')}
      >
        {(props) => (
          <PasswordInput
            {...props}
            name="newPassword"
            autoComplete="new-password"
            minLength={10}
            required
          />
        )}
      </Field>

      <Field label={t('confirmPassword')} required error={form.error('confirmPassword')}>
        {(props) => (
          <PasswordInput {...props} name="confirmPassword" autoComplete="new-password" required />
        )}
      </Field>

      <Button type="submit" loading={form.pending} className="self-start">
        {temporary ? t('setPassword') : t('changePassword')}
      </Button>
    </form>
  );
}
