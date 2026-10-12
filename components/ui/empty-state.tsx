import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  icon?: LucideIcon;
  /** A picture from components/illustrations; shown instead of the icon. */
  illustration?: React.ReactNode;
  title: string;
  /** What the person can do next — never just "No data". */
  description: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'border-border flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      {illustration ? (
        // Fixed height so the box never jumps as the drawing scales.
        <div className="flex h-28 w-full max-w-56 items-end justify-center [&>svg]:h-full [&>svg]:w-auto">
          {illustration}
        </div>
      ) : (
        Icon && <Icon aria-hidden className="text-foreground-muted size-8" />
      )}
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-foreground-muted max-w-prose text-sm">{description}</p>
      {action}
    </div>
  );
}
