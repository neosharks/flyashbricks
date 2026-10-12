import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChangePasswordForm } from '@/components/auth/change-password-form';
import { SignOutButton } from '@/components/layout/sign-out-button';
import { getSessionUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Set your password' };

/** Where every page sends someone still on the temporary password an admin gave them. */
export default async function SetPasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!user.mustChangePassword) redirect('/');

  const t = await getTranslations('auth');
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t('setPasswordTitle')}</h1>
      <p className="text-foreground-muted mt-2 mb-8 text-sm">{t('setPasswordSubtitle')}</p>
      <ChangePasswordForm temporary redirectTo="/" />
      <div className="border-border mt-6 border-t pt-4">
        <SignOutButton />
      </div>
    </>
  );
}
