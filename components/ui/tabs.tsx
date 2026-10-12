import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Page-level tabs as links, so each tab has a URL and back/forward works. */
export function LinkTabs({
  label,
  tabs,
  current,
}: {
  label: string;
  tabs: { href: string; label: string; id: string }[];
  current: string;
}) {
  return (
    <nav aria-label={label} className="border-border mb-6 border-b">
      <ul className="-mb-px flex gap-4 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.id === current;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center border-b-2 px-1 text-sm font-medium whitespace-nowrap',
                  active
                    ? 'border-action text-action'
                    : 'text-foreground-muted hover:text-foreground hover:border-border-strong border-transparent',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
