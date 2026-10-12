import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type QuickAction = { href: string; label: string; icon: LucideIcon; primary?: boolean };

/**
 * The four things people come to the app to do, as big tiles. Most visits
 * start and end here, so each is one tap from opening the app.
 */
export function QuickActions({ title, actions }: { title: string; actions: QuickAction[] }) {
  if (actions.length === 0) return null;
  return (
    <section aria-labelledby="quick-actions">
      <h2 id="quick-actions" className="sr-only">
        {title}
      </h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {actions.map(({ href, label, icon: Icon, primary }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                'flex min-h-24 flex-col items-start justify-between gap-3 rounded-xl border p-4 text-base font-semibold shadow-xs transition-colors',
                primary
                  ? 'bg-action text-action-foreground hover:bg-action-hover border-transparent'
                  : 'border-border bg-surface hover:bg-surface-muted',
              )}
            >
              <span
                className={cn(
                  'rounded-lg p-2',
                  primary ? 'bg-white/15' : 'bg-action-subtle text-action',
                )}
              >
                <Icon aria-hidden className="size-5" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
