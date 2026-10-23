'use client';

import { useTranslations } from 'next-intl';
import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_DIGITS = 9;

/** The text after pressing `key` (a digit, "00", "." or "back"); a key that would not fit is ignored. */
export function pressKey(value: string, key: string, decimals: number): string {
  if (key === 'back') return value.slice(0, -1);
  const dot = value.indexOf('.');
  if (key === '.') {
    if (decimals === 0 || dot !== -1) return value;
    return `${value || '0'}.`;
  }
  if (dot !== -1) {
    const room = decimals - (value.length - dot - 1);
    return room <= 0 ? value : value + key.slice(0, room);
  }
  // Zeros on nothing stay nothing; a leading zero gives way to the next digit.
  if (value === '' && /^0+$/.test(key)) return '';
  const next = (value + key).replace(/^0+(?=\d)/, '');
  return next.length > MAX_DIGITS ? value : next;
}

/**
 * Number entry without the phone keyboard: the figure in large type, the
 * usual amounts as one-tap presets, and a keypad big enough for a thumb.
 * The typed text is posted as is; the server parses and validates it.
 */
export function NumberPad({
  label,
  value,
  onChange,
  presets = [],
  decimals = 0,
  prefix,
  suffix,
  format,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  presets?: { label: string; value: string }[];
  /** Places allowed after the point; 0 hides the point key. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** How the figure is shown, e.g. with Indian digit grouping. */
  format?: (value: string) => string;
  hint?: React.ReactNode;
  error?: string | undefined;
}) {
  const t = useTranslations('quick.pad');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimals > 0 ? '.' : '00', '0'];
  const shown = value === '' ? '0' : (format?.(value) ?? value);

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          'bg-surface rounded-xl border px-4 py-3',
          error ? 'border-danger ring-danger ring-1' : 'border-border-strong',
        )}
      >
        <p className="text-foreground-muted text-sm">{label}</p>
        <p
          className={cn(
            'mt-0.5 text-4xl font-semibold tracking-tight tabular-nums',
            value === '' && 'text-foreground-subtle',
          )}
          aria-live="polite"
        >
          {prefix}
          {shown}
          {suffix && (
            <span className="text-foreground-muted ml-2 text-lg font-medium">{suffix}</span>
          )}
        </p>
        {hint && <p className="text-foreground-muted mt-1 text-sm">{hint}</p>}
        {error && <p className="text-danger mt-1 text-sm font-medium">{error}</p>}
      </div>

      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(preset.value)}
              className={cn(
                'min-h-11 rounded-full border px-4 text-sm font-semibold tabular-nums',
                preset.value === value
                  ? 'border-action bg-action-subtle text-action'
                  : 'border-border-strong bg-surface hover:bg-surface-muted',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('keypad')}>
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(pressKey(value, key, decimals))}
            className="bg-surface border-border hover:bg-surface-muted active:bg-border min-h-14 rounded-xl border text-2xl font-semibold tabular-nums"
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(pressKey(value, 'back', decimals))}
          onDoubleClick={() => onChange('')}
          aria-label={t('erase')}
          className="bg-surface-muted border-border hover:bg-border flex min-h-14 items-center justify-center rounded-xl border"
        >
          <Delete aria-hidden className="size-6" />
        </button>
      </div>
    </div>
  );
}
