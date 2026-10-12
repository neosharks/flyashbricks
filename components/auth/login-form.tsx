'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { signInWithCredentials } from '@/features/auth/actions';
import { useActionForm } from '@/hooks/use-action-form';

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const form = useActionForm(signInWithCredentials, (data) => {
    // A full navigation, so every server component re-reads the new session.
    router.replace(data.callbackUrl);
    router.refresh();
  });

  return (
    <form method="post" onSubmit={form.onSubmit} className="flex flex-col gap-4" noValidate>
      {form.formError && <Alert tone="danger">{form.formError}</Alert>}
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <Field label={t('identifier')} required>
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

      <Field label={t('password')} required>
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
