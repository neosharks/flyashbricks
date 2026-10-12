'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { KeyRound, LogOut, UserCheck, UserX } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import {
  resetUserPassword,
  setUserDisabled,
  signOutUserEverywhere,
} from '@/features/users/actions';
import { TemporaryPasswordDialog } from './temporary-password-dialog';

export function UserSecurityActions({
  id,
  name,
  disabled,
}: {
  id: string;
  name: string;
  disabled: boolean;
}) {
  const t = useTranslations('users.actions');
  const tc = useTranslations('common');
  const router = useRouter();
  const [password, setPassword] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogTrigger asChild>
          <Button variant="danger-soft">
            <KeyRound aria-hidden />
            {t('resetPassword')}
          </Button>
        </DialogTrigger>
        <DialogContent
          title={t('resetPasswordTitle', { name })}
          description={t('resetPasswordBody')}
        >
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await resetUserPassword(id);
                  if (result.ok) {
                    setResetOpen(false);
                    setError(null);
                    setPassword(result.data.temporaryPassword);
                    router.refresh();
                  } else {
                    setError(result.message);
                  }
                })
              }
            >
              {t('resetPasswordConfirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmButton
        title={t('signOutEverywhereTitle', { name })}
        description={t('signOutEverywhereBody')}
        confirmLabel={t('signOutEverywhereConfirm')}
        successMessage={t('signedOut')}
        variant="danger-soft"
        action={() => signOutUserEverywhere(id)}
      >
        <LogOut aria-hidden />
        {t('signOutEverywhere')}
      </ConfirmButton>

      {disabled ? (
        <ConfirmButton
          title={t('enableTitle', { name })}
          description={t('enableBody')}
          confirmLabel={t('enableConfirm')}
          successMessage={t('enabled')}
          confirmVariant="primary"
          action={() => setUserDisabled(id, false)}
        >
          <UserCheck aria-hidden />
          {t('enable')}
        </ConfirmButton>
      ) : (
        <ConfirmButton
          title={t('disableTitle', { name })}
          description={t('disableBody')}
          confirmLabel={t('disableConfirm')}
          successMessage={t('disabled')}
          variant="danger-soft"
          action={() => setUserDisabled(id, true)}
        >
          <UserX aria-hidden />
          {t('disable')}
        </ConfirmButton>
      )}

      <TemporaryPasswordDialog name={name} password={password} onDone={() => setPassword(null)} />
    </div>
  );
}
