import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A whole-width button for picking one thing: a name on top, a detail under it. */
export function BigChoice({
  title,
  detail,
  trailing,
  selected = false,
  tone = 'default',
  onClick,
  icon,
}: {
  title: string;
  detail?: React.ReactNode;
  trailing?: React.ReactNode;
  selected?: boolean;
  tone?: 'default' | 'muted';
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
        selected
          ? 'border-action bg-action-subtle ring-action ring-1'
          : tone === 'muted'
            ? 'border-border-strong bg-surface-muted hover:bg-border border-dashed'
            : 'border-border-strong bg-surface hover:bg-surface-muted',
      )}
    >
      {icon && <span className="text-action shrink-0">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-lg leading-snug font-semibold">{title}</span>
        {detail && <span className="text-foreground-muted block text-sm">{detail}</span>}
      </span>
      {trailing && <span className="shrink-0 text-right text-sm font-medium">{trailing}</span>}
      {selected && <Check aria-hidden className="text-action size-6 shrink-0" />}
    </button>
  );
}
