'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Bold, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZES = ['sm', 'md', 'lg', 'xl', 'xxl'] as const;
type Size = (typeof SIZES)[number];

const SIZE_KEY = 'flyash.textSize';
const BOLD_KEY = 'flyash.bold';
const CHANGE_EVENT = 'flyash:display';

type Display = { size: Size; bold: boolean };

function read(): string {
  try {
    const size = localStorage.getItem(SIZE_KEY);
    const bold = localStorage.getItem(BOLD_KEY) === '1';
    return `${SIZES.includes(size as Size) ? size : 'md'}|${bold ? '1' : '0'}`;
  } catch {
    return 'md|0';
  }
}

function parse(snapshot: string): Display {
  const [size, bold] = snapshot.split('|');
  return { size: (size as Size | undefined) ?? 'md', bold: bold === '1' };
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Applies to <html> at once (the pre-paint script does the same on load) and saves on this device. */
function apply(next: Display): void {
  const root = document.documentElement;
  if (next.size === 'md') root.removeAttribute('data-text-size');
  else root.setAttribute('data-text-size', next.size);
  root.toggleAttribute('data-bold', next.bold);
  try {
    if (next.size === 'md') localStorage.removeItem(SIZE_KEY);
    else localStorage.setItem(SIZE_KEY, next.size);
    if (next.bold) localStorage.setItem(BOLD_KEY, '1');
    else localStorage.removeItem(BOLD_KEY);
  } catch {
    // Storage blocked: the choice still applies to this page.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Text size (five steps) and bolder text, for people who find the screen
 * hard to read. `compact` is the one-row version for the sidebar and the
 * phone menu; the full version on My account explains each control.
 */
export function DisplaySettings({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('common.display');
  const current = parse(useSyncExternalStore(subscribe, read, () => 'md|0'));
  const index = SIZES.indexOf(current.size);

  const stepper = (
    <div
      className="border-border inline-flex items-center rounded-md border p-0.5"
      role="group"
      aria-label={t('size')}
    >
      <button
        type="button"
        onClick={() => apply({ ...current, size: SIZES[Math.max(0, index - 1)] ?? 'md' })}
        disabled={index === 0}
        aria-label={t('smaller')}
        className="text-foreground-muted hover:text-foreground flex size-11 items-center justify-center rounded disabled:opacity-40 lg:size-9"
      >
        <Minus aria-hidden className="size-4" />
      </button>
      <span className="min-w-12 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {t(`sizes.${current.size}`)}
      </span>
      <button
        type="button"
        onClick={() =>
          apply({ ...current, size: SIZES[Math.min(SIZES.length - 1, index + 1)] ?? 'md' })
        }
        disabled={index === SIZES.length - 1}
        aria-label={t('larger')}
        className="text-foreground-muted hover:text-foreground flex size-11 items-center justify-center rounded disabled:opacity-40 lg:size-9"
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </div>
  );

  const bold = (
    <button
      type="button"
      aria-pressed={current.bold}
      onClick={() => apply({ ...current, bold: !current.bold })}
      title={t('bold')}
      className={cn(
        'border-border inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors lg:min-h-10',
        current.bold
          ? 'bg-action-subtle text-action border-action'
          : 'text-foreground-muted hover:text-foreground',
      )}
    >
      <Bold aria-hidden className="size-4" />
      {compact ? <span className="sr-only">{t('bold')}</span> : t('bold')}
    </button>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {stepper}
        {bold}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t('size')}</p>
          <p className="text-foreground-muted text-xs">{t('sizeHint')}</p>
        </div>
        {stepper}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t('bold')}</p>
          <p className="text-foreground-muted text-xs">{t('boldHint')}</p>
        </div>
        {bold}
      </div>
      <p className="bg-surface-muted rounded-md p-3 text-sm">{t('preview')}</p>
    </div>
  );
}
