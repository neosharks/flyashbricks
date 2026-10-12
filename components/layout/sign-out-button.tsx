'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { signOutAction } from '@/features/auth/actions';

export function SignOutButton({
  variant = 'danger-soft',
  className,
}: {
  variant?: ButtonProps['variant'];
  className?: string;
}) {
  const t = useTranslations('nav');
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      loading={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          await signOutAction();
        })
      }
    >
      {!pending && <LogOut aria-hidden />}
      {pending ? t('signingOut') : t('signOut')}
    </Button>
  );
}
