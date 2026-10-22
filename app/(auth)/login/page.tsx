import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/auth/login-form';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/features/auth/demo-accounts';
import { devicePinGreeting } from '@/features/auth/device-pin';
import { DEVICE_COOKIE_NAME } from '@/lib/cookies';
import { env } from '@/lib/env';
import { requestLocale } from '@/lib/locale';
import { getSessionUser } from '@/lib/session';
import { safeAppPath } from '@/lib/safe-path';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl: raw } = await searchParams;
  // Only a path inside this app: anything else would make sign-in a phishing tool.
  const callbackUrl = safeAppPath(raw);

  if (await getSessionUser()) redirect(callbackUrl);

  const [t, locale, jar] = await Promise.all([getTranslations('auth'), requestLocale(), cookies()]);
  // A device with a PIN opens on the PIN; only the first name is looked up.
  const pinName = await devicePinGreeting(jar.get(DEVICE_COOKIE_NAME)?.value ?? null, locale);
  const demo = env.DEMO_LOGINS
    ? DEMO_ACCOUNTS.map(({ tier, phone }) => ({ tier, phone, password: DEMO_PASSWORD }))
    : [];
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t('signInHeading')}</h1>
      <p className="text-foreground-muted mt-2 mb-8 text-sm">{t('signInSubtitle')}</p>
      <LoginForm callbackUrl={callbackUrl} pinName={pinName} demo={demo} />
      <div className="border-border text-foreground-muted mt-8 flex flex-col gap-1 border-t pt-6 text-xs">
        <p>{t('forgot')}</p>
        <p>{t('noAccount')}</p>
      </div>
    </>
  );
}
