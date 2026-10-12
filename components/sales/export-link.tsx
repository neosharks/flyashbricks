import { Download } from 'lucide-react';
import { tableHref, type QueryState } from '@/lib/table-href';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Downloads the list as CSV with the filters on screen. A plain link (not a
 * client fetch), so the browser handles the download and its progress.
 */
export function ExportLink({
  href,
  query,
  label,
}: {
  href: string;
  query: QueryState;
  label: string;
}) {
  const { after: _after, before: _before, size: _size, ...filters } = query;
  return (
    <a
      href={tableHref(href, filters, {})}
      download
      className={cn(buttonVariants({ variant: 'outline' }), 'w-full sm:w-auto')}
    >
      <Download aria-hidden />
      {label}
    </a>
  );
}
