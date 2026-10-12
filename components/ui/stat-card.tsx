import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'action';

const ICON_TONES: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-foreground-muted',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  action: 'bg-action-subtle text-action',
};

type StatCardProps = {
  label: string;
  value: string;
  /** Context under the value: "vs last month", "3 customers". */
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  /** Optional small visual under the value — a meter or a sparkline. */
  children?: React.ReactNode;
  className?: string;
};

/** A labelled headline number. The tone colours the icon only, never the value. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  children,
  className,
}: StatCardProps) {
  return (
    <div className={cn('border-border bg-surface rounded-lg border p-4 shadow-xs', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-foreground-muted text-sm">{label}</p>
        {Icon && (
          <span className={cn('rounded-md p-1.5', ICON_TONES[tone])}>
            <Icon aria-hidden className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
      {hint && <div className="text-foreground-muted mt-1 text-xs">{hint}</div>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
