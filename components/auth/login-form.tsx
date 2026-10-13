'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormErrors } from '@/components/ui/form-errors';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { signInWithCredentials, signInWithPin } from '@/features/auth/actions';
import { CredentialsSchema, PinSignInSchema } from '@/features/auth/schema';
import { useActionForm } from '@/hooks/use-action-form';

/** Failures after which this device's PIN is gone and only the password is left. */
const PIN_GONE = new Set(['PIN_LOCKED', 'PIN_UNAVAILABLE']);

/**
 * Opens on the PIN when this device has one (`pinName` is the person's first
 * name), with the phone and password always one tap away.
 */
export function LoginForm({
  callbackUrl,
  pinName = null,
}: {
  callbackUrl: string;
  pinName?: string | null;
}) {
  const [mode, setMode] = useState<'pin' | 'password'>(pinName ? 'pin' : 'password');
  const [pinGone, setPinGone] = useState<string | null>(null);

  if (mode === 'pin' && pinName) {
    return (
      <PinForm
        callbackUrl={callbackUrl}
        name={pinName}
        onUsePassword={() => setMode('password')}
        onPinGone={(message) => {
          setPinGone(message);
          setMode('password');
        }}
      />
    );
  }
  return (
    <PasswordForm
      callbackUrl={callbackUrl}
      notice={pinGone}
      onUsePin={pinName && !pinGone ? () => setMode('pin') : undefined}
    />
  );
}

function useSignedIn() {
  const router = useRouter();
  return (data: { callbackUrl: string }) => {
    // A full navigation, so every server component re-reads the new session.
    router.replace(data.callbackUrl);
    router.refresh();
  };
}

function PinForm({
  callbackUrl,
  name,
  onUsePassword,
  onPinGone,
}: {
  callbackUrl: string;
  name: string;
  onUsePassword: () => void;
  onPinGone: (message: string) => void;
}) {
  const t = useTranslations('auth.quickPin');
  const form = useActionForm(signInWithPin, useSignedIn(), {
    schema: PinSignInSchema,
    prepare: (raw) => ({ pin: raw.pin }),
  });

  const failure = form.state && !form.state.ok ? form.state : null;
  useEffect(() => {
    if (failure && PIN_GONE.has(failure.code)) onPinGone(failure.message);
  }, [failure, onPinGone]);

  return (
    <form
      method="post"
      onSubmit={form.onSubmit}
      onChange={form.onChange}
      onBlur={form.onBlur}
      className="flex flex-col gap-4"
      noValidate
    >
      <div>
        <p className="text-lg font-semibold">{t('welcome', { name })}</p>
        <p className="text-foreground-muted text-sm">{t('enterPin')}</p>
      </div>
      <FormErrors form={form} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <Field label={t('pin')} required error={form.error('pin')}>
        {(props) => (
          <Input
            {...props}
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="off"
            required
            className="text-center text-2xl tracking-[0.5em]"
          />
        )}
      </Field>

      <Button type="submit" full loading={form.pending || form.state?.ok === true}>
        {t('signIn')}
      </Button>
      <Button type="button" variant="link" className="self-center" onClick={onUsePassword}>
        {t('usePassword')}
      </Button>
    </form>
  );
}

function PasswordForm({
  callbackUrl,
  notice,
  onUsePin,
}: {
  callbackUrl: string;
  notice: string | null;
  onUsePin: (() => void) | undefined;
}) {
  const t = useTranslations('auth');
  const form = useActionForm(signInWithCredentials, useSignedIn(), {
    schema: CredentialsSchema,
    prepare: (raw) => ({ identifier: raw.identifier, password: raw.password }),
  });

  return (
    <form
      method="post"
      onSubmit={form.onSubmit}
      onChange={form.onChange}
      onBlur={form.onBlur}
      className="flex flex-col gap-4"
      noValidate
    >
      {notice && <Alert tone="danger">{notice}</Alert>}
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
      {onUsePin && (
        <Button type="button" variant="link" className="self-center" onClick={onUsePin}>
          {t('quickPin.usePin')}
        </Button>
      )}
    </form>
  );
}
