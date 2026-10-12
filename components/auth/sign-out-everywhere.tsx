'use client';

import { useTranslations } from 'next-intl';
import { MonitorSmartphone } from 'lucide-react';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { signOutEverywhere } from '@/features/auth/actions';
import { ok } from '@/lib/result';

/** For a lost phone or a shared computer: every session ends, this one included. */
export function SignOutEverywhereButton() {
  const t = useTranslations('auth.everywhere');
  return (
    <ConfirmButton
      title={t('title')}
      description={t('body')}
      confirmLabel={t('confirm')}
      successMessage={t('done')}
      variant="danger-soft"
      action={async () => {
        await signOutEverywhere();
        return ok();
      }}
    >
      <MonitorSmartphone aria-hidden />
      {t('button')}
    </ConfirmButton>
  );
}
