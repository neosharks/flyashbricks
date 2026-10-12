import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type SpinnerProps = {
  className?: string;
  /** Announced to screen readers. Null when a nearby control or live region already says it. */
  label: string | null;
};

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <>
      <Loader2 aria-hidden className={cn('size-4 animate-spin', className)} />
      {label !== null && <span className="sr-only">{label}</span>}
    </>
  );
}
