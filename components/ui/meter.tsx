import { cn } from '@/lib/utils';

export type Level = 'good' | 'warning' | 'critical';

const FILL: Record<Level, string> = {
  good: 'bg-status-good',
  warning: 'bg-status-warning',
  critical: 'bg-status-critical',
};

const TRACK: Record<Level, string> = {
  good: 'bg-success-subtle',
  warning: 'bg-warning-subtle',
  critical: 'bg-danger-subtle',
};

/**
 * A horizontal fill bar. Colour carries severity, the track is a lighter step
 * of the same hue, and the label beside it always states the level in words —
 * colour is never the only signal.
 */
export function Meter({
  value,
  max,
  level,
  label,
  className,
}: {
  value: number;
  max: number;
  level: Level;
  label: string;
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.max(0, Math.min(value, max))}
      className={cn('h-2 w-full overflow-hidden rounded-full', TRACK[level], className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', FILL[level])}
        style={{ width: `${Math.max(ratio * 100, value > 0 ? 2 : 0)}%` }}
      />
    </div>
  );
}
