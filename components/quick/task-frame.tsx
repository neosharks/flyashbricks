'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, X } from 'lucide-react';

/**
 * One screen of a simple-mode task: what is being done, how far along it is,
 * the one question being asked, and the button that moves on, kept in reach
 * of a thumb at the bottom of the screen.
 */
export function TaskFrame({
  title,
  step,
  steps,
  question,
  onBack,
  backHref,
  footer,
  children,
}: {
  title: string;
  /** 0-based. */
  step: number;
  steps: number;
  question: string;
  /** Goes to the previous step; on the first step the back arrow leaves the task. */
  onBack?: (() => void) | undefined;
  /** The previous step when it is its own page. */
  backHref?: string | undefined;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations('quick');
  const back =
    'flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-muted';

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] flex-col">
      <div className="flex items-center gap-2 pt-3">
        {step > 0 && onBack ? (
          <button type="button" onClick={onBack} className={back} aria-label={t('back')}>
            <ArrowLeft aria-hidden className="size-5" />
          </button>
        ) : backHref ? (
          <Link href={backHref} className={back} aria-label={t('back')}>
            <ArrowLeft aria-hidden className="size-5" />
          </Link>
        ) : (
          <Link href="/quick" className={back} aria-label={t('close')}>
            <X aria-hidden className="size-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-foreground-muted truncate text-sm font-medium">{title}</p>
          {steps > 1 && (
            <p className="text-foreground-subtle text-xs">
              {t('stepOf', { step: step + 1, steps })}
            </p>
          )}
        </div>
      </div>
      {steps > 1 && (
        <div
          className="bg-surface-muted mt-2 h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps}
          aria-valuenow={step + 1}
          aria-label={t('stepOf', { step: step + 1, steps })}
        >
          <div
            className="bg-action h-full rounded-full transition-[width] duration-300"
            style={{ width: `${((step + 1) / steps) * 100}%` }}
          />
        </div>
      )}

      <h1 className="mt-6 text-2xl leading-tight font-semibold tracking-tight">{question}</h1>
      <div className="mt-5 flex flex-1 flex-col gap-4 pb-6">{children}</div>

      {footer && (
        <div className="border-border bg-canvas/95 sticky bottom-0 -mx-4 flex flex-col gap-2 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          {footer}
        </div>
      )}
    </div>
  );
}
