'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A dialog that takes the whole screen — for content that needs the room,
 * like a chart with its full table. Radix supplies the focus trap, Escape and
 * scroll lock; this only changes the shape. The header stays put while the
 * body scrolls, and pads for the notch on an installed phone app.
 */
export function FullscreenDialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | undefined;
  closeLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          className={cn(
            'bg-canvas fixed inset-0 z-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] outline-none',
            className,
          )}
        >
          <div className="border-border bg-surface flex items-start justify-between gap-4 border-b px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-foreground-muted text-sm">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">
                  {title}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="border-border hover:bg-surface-muted flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium">
              <X aria-hidden className="size-4" />
              {closeLabel}
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">{children}</div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
