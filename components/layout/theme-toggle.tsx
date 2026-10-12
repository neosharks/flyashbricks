'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'flyash.theme';
const MODES = [
  { value: 'light', Icon: Sun },
  { value: 'system', Icon: Monitor },
  { value: 'dark', Icon: Moon },
] as const;

type Mode = (typeof MODES)[number]['value'];

const CHANGE_EVENT = 'flyash:theme';

function readMode(): Mode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'dark' || saved === 'light' ? saved : 'system';
  } catch {
    // Storage blocked: the system preference stands.
    return 'system';
  }
}

/** Every toggle on the page (sidebar, menu sheet) stays in step through this. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function apply(mode: Mode): void {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  if (mode !== 'system') root.classList.add(mode);

  try {
    if (mode === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private browsing can refuse storage; the choice still applies for this page.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function ThemeToggle() {
  const t = useTranslations('common.theme');
  const mode = useSyncExternalStore(subscribe, readMode, (): Mode => 'system');

  return (
    <fieldset className="border-border inline-flex rounded-md border p-0.5">
      <legend className="sr-only">{t('label')}</legend>
      {MODES.map(({ value, Icon }) => (
        <label
          key={value}
          className={cn(
            'flex size-11 cursor-pointer items-center justify-center rounded transition-colors lg:size-9',
            mode === value
              ? 'bg-action-subtle text-action'
              : 'text-foreground-muted hover:text-foreground',
          )}
          title={t(value)}
        >
          <input
            type="radio"
            name="theme"
            value={value}
            checked={mode === value}
            onChange={() => apply(value)}
            className="sr-only"
          />
          <Icon aria-hidden className="size-4" />
          <span className="sr-only">{t(value)}</span>
        </label>
      ))}
    </fieldset>
  );
}
