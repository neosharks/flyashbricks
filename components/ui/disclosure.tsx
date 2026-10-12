import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * "More options": tucks rarely used fields away so a form shows only what most
 * people need. Native <details>, so it works without JavaScript and keeps
 * its fields in the form (and submitted) while closed.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
}: {
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={cn('group border-border rounded-lg border', className)}>
      <summary className="hover:bg-surface-muted flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown
          aria-hidden
          className="text-foreground-muted size-4 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-border border-t p-3">{children}</div>
    </details>
  );
}
