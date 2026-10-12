import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/auth/login-form';
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

  const t = await getTranslations('auth');
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t('signInHeading')}</h1>
      <p className="text-foreground-muted mt-2 mb-8 text-sm">{t('signInSubtitle')}</p>
      <LoginForm callbackUrl={callbackUrl} />
      <div className="border-border text-foreground-muted mt-8 flex flex-col gap-1 border-t pt-6 text-xs">
        <p>{t('forgot')}</p>
        <p>{t('noAccount')}</p>
      </div>
    </>
  );
}
