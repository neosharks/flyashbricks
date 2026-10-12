import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

type PageHeaderProps = {
  title: string;
  description?: string | undefined;
  /** Shown as a small "back" link above the title on detail pages. */
  back?: { href: string; label: string } | undefined;
  /** Primary actions; they wrap under the title on a phone. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

export function PageHeader({ title, description, back, actions, children }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="text-foreground-muted hover:text-foreground -mt-3 -mb-2 inline-flex min-h-11 items-center gap-1 text-sm"
          >
            <ChevronLeft aria-hidden className="size-4" />
            {back.label}
          </Link>
        )}
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="text-foreground-muted mt-1 text-sm">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
