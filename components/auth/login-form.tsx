'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { FormErrors } from '@/components/ui/form-errors';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { signInWithCredentials } from '@/features/auth/actions';
import { CredentialsSchema } from '@/features/auth/schema';
import { useActionForm } from '@/hooks/use-action-form';

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const form = useActionForm(
    signInWithCredentials,
    (data) => {
      // A full navigation, so every server component re-reads the new session.
      router.replace(data.callbackUrl);
      router.refresh();
    },
    {
      schema: CredentialsSchema,
      prepare: (raw) => ({ identifier: raw.identifier, password: raw.password }),
    },
  );

  return (
    <form
      method="post"
      onSubmit={form.onSubmit}
      onChange={form.onChange}
      onBlur={form.onBlur}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormErrors form={form} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <Field label={t('identifier')} required error={form.error('identifier')}>
        {(props) => (
          <Input
            {...props}
            name="identifier"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            required
          />
        )}
      </Field>

      <Field label={t('password')} required error={form.error('password')}>
        {(props) => (
          <PasswordInput {...props} name="password" autoComplete="current-password" required />
        )}
      </Field>

      <Button type="submit" full loading={form.pending || form.state?.ok === true}>
        {form.pending ? t('signingIn') : t('signIn')}
      </Button>
    </form>
  );
}
