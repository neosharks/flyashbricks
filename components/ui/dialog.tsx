'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/**
 * Radix handles the focus trap, Escape, scroll lock and ARIA wiring. Those are
 * the parts hand-rolled dialogs consistently get wrong.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentPropsWithRef<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string | undefined;
}) {
  const t = useTranslations('common');
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        className={cn(
          'border-border bg-surface fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-lg border p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lg',
          'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:pb-5',
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-foreground-muted mt-1 text-sm">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            className="text-foreground-muted hover:bg-surface-muted -m-3 shrink-0 rounded-md p-3"
            aria-label={t('close')}
          >
            <X aria-hidden className="size-5" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
