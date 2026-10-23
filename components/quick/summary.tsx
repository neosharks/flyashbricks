import { cn } from '@/lib/utils';

/** The "check before saving" card: one row per answer given. */
export function Summary({ children }: { children: React.ReactNode }) {
  return (
    <dl className="border-border bg-surface divide-border divide-y rounded-xl border">
      {children}
    </dl>
  );
}

export function SummaryRow({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'danger' | 'success' | undefined;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="text-foreground-muted">{label}</dt>
      <dd
        className={cn(
          'text-right tabular-nums',
          strong ? 'text-xl font-semibold' : 'font-medium',
          tone === 'danger' && 'text-danger',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
