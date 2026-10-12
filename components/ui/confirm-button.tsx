'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ActionResult } from '@/lib/result';
import { Button, type ButtonProps } from './button';
import { Dialog, DialogContent, DialogTrigger } from './dialog';
import { Alert } from './alert';

type ConfirmButtonProps = {
  /** The button that opens the confirmation. */
  children: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  successMessage: string;
  action: () => Promise<ActionResult<unknown>>;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  confirmVariant?: ButtonProps['variant'];
};

/** A button that asks first. For actions that are disruptive but not a form. */
export function ConfirmButton({
  children,
  title,
  description,
  confirmLabel,
  successMessage,
  action,
  variant = 'outline',
  size = 'md',
  confirmVariant = 'danger',
}: ConfirmButtonProps) {
  const t = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          {children}
        </Button>
      </DialogTrigger>
      <DialogContent title={title} description={description}>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {t('cancel')}
          </Button>
          <Button
            variant={confirmVariant}
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await action();
                if (result.ok) {
                  setOpen(false);
                  toast.success(successMessage);
                  router.refresh();
                } else {
                  setError(result.message);
                }
              })
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
