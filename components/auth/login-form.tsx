'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormErrors } from '@/components/ui/form-errors';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { signInWithCredentials, signInWithPin } from '@/features/auth/actions';
import type { DemoTier } from '@/features/auth/demo-accounts';
import { CredentialsSchema, PinSignInSchema } from '@/features/auth/schema';
import { useActionForm } from '@/hooks/use-action-form';

export type DemoSignIn = { tier: DemoTier; phone: string; password: string };

/** Failures after which this device's PIN is gone and only the password is left. */
const PIN_GONE = new Set(['PIN_LOCKED', 'PIN_UNAVAILABLE']);

/**
 * Opens on the PIN when this device has one (`pinName` is the person's first
 * name), with the phone and password always one tap away. `demo` lists the
 * demo company's sign-ins on a demo server.
 */
export function LoginForm({
  callbackUrl,
  pinName = null,
  demo = [],
}: {
  callbackUrl: string;
  pinName?: string | null;
  demo?: DemoSignIn[];
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
      demo={demo}
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
  demo,
}: {
  callbackUrl: string;
  notice: string | null;
  onUsePin: (() => void) | undefined;
  demo: DemoSignIn[];
}) {
  const t = useTranslations('auth');
  const formRef = useRef<HTMLFormElement>(null);
  const form = useActionForm(signInWithCredentials, useSignedIn(), {
    schema: CredentialsSchema,
    prepare: (raw) => ({ identifier: raw.identifier, password: raw.password }),
  });

  // The inputs are uncontrolled (use-action-form), so a demo pick writes them directly.
  function fill(account: DemoSignIn) {
    const fields = formRef.current?.elements;
    const identifier = fields?.namedItem('identifier');
    const password = fields?.namedItem('password');
    if (identifier instanceof HTMLInputElement) identifier.value = account.phone;
    if (password instanceof HTMLInputElement) password.value = account.password;
  }

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
      {demo.length > 0 && <DemoSignIns accounts={demo} onPick={fill} />}
    </form>
  );
}

function DemoSignIns({
  accounts,
  onPick,
}: {
  accounts: DemoSignIn[];
  onPick: (account: DemoSignIn) => void;
}) {
  const t = useTranslations('auth.demo');
  return (
    <section
      aria-labelledby="demo-sign-ins"
      className="border-border bg-surface-muted mt-2 rounded-lg border p-4 text-sm"
    >
      <h2 id="demo-sign-ins" className="font-semibold">
        {t('title')}
      </h2>
      <p className="text-foreground-muted mt-1 text-xs">
        {t('body', { password: accounts[0]?.password ?? '' })}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {accounts.map((account) => (
          <li key={account.phone} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{t(`tiers.${account.tier}.name`)}</p>
              <p className="text-foreground-muted text-xs">
                <span className="font-mono">{account.phone}</span> ·{' '}
                {t(`tiers.${account.tier}.access`)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPick(account)}
              aria-label={t('useAs', { tier: t(`tiers.${account.tier}.name`) })}
            >
              {t('use')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
