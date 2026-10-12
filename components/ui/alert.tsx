import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertProps = {
  tone?: 'info' | 'success' | 'danger';
  title?: string;
  children: React.ReactNode;
  className?: string;
};

const TONES = {
  info: { wrapper: 'bg-action-subtle text-action', Icon: Info, role: 'status' as const },
  success: {
    wrapper: 'bg-success-subtle text-success',
    Icon: CheckCircle2,
    role: 'status' as const,
  },
  danger: { wrapper: 'bg-danger-subtle text-danger', Icon: AlertCircle, role: 'alert' as const },
};

/**
 * Inline, not a toast: an error the person has to fix must stay on screen next
 * to the thing that needs fixing.
 */
export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  const { wrapper, Icon, role } = TONES[tone];

  return (
    <div role={role} className={cn('flex gap-3 rounded-md px-4 py-3 text-sm', wrapper, className)}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className="[&_a]:underline">{children}</div>
      </div>
    </div>
  );
}
