'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/** The three ways money usually comes in; cheque and the rest stay on the full forms. */
export const MODES = ['cash', 'upi', 'bank'] as const;
export type Mode = (typeof MODES)[number];

export function ModePicker({
  value,
  onChange,
  label,
}: {
  value: Mode;
  onChange: (mode: Mode) => void;
  label: string;
}) {
  const ts = useTranslations('sales');
  return (
    <fieldset>
      <legend className="mb-2 font-medium">{label}</legend>
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={cn(
              'min-h-14 rounded-xl border text-base font-semibold',
              value === option
                ? 'border-action bg-action-subtle text-action ring-action ring-1'
                : 'border-border-strong bg-surface hover:bg-surface-muted',
            )}
          >
            {ts(`modes.${option}`)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
