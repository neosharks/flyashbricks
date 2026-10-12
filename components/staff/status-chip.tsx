import { cn } from '@/lib/utils';
import type { AttendanceStatus } from '@/models/constants';

/**
 * Attendance colours read at a glance: present green, half day amber, absent
 * red, leave blue, holiday violet. The word is always shown with the colour.
 */
export const STATUS_TONES: Record<AttendanceStatus | 'none', string> = {
  present: 'bg-success-subtle text-success border-success/40',
  half_day: 'bg-warning-subtle text-warning border-warning/40',
  absent: 'bg-danger-subtle text-danger border-danger/40',
  leave: 'bg-info-subtle text-info border-info/40',
  holiday: 'bg-holiday-subtle text-holiday border-holiday/40',
  none: 'bg-surface text-foreground-subtle border-dashed border-border-strong',
};

/** Selected-state colours for the big buttons on the attendance sheet. */
export const STATUS_SELECTED: Record<AttendanceStatus, string> = {
  present: 'bg-success text-surface border-success',
  half_day: 'bg-warning text-surface border-warning',
  absent: 'bg-danger text-surface border-danger',
  leave: 'bg-info text-surface border-info',
  holiday: 'bg-holiday text-surface border-holiday',
};

/** A small swatch for summaries and legends, next to the status word. */
export const STATUS_DOT: Record<AttendanceStatus, string> = {
  present: 'bg-success',
  half_day: 'bg-warning',
  absent: 'bg-danger',
  leave: 'bg-info',
  holiday: 'bg-holiday',
};

export function StatusChip({
  status,
  label,
  className,
}: {
  status: AttendanceStatus | null;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_TONES[status ?? 'none'],
        className,
      )}
    >
      {label}
    </span>
  );
}
