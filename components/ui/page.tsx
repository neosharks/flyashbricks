import { cn } from '@/lib/utils';

/**
 * The layout system for every screen. The app shell sets the outer frame
 * (side padding, safe areas, the 7xl ceiling); a page only picks how wide its
 * content runs, and the column is always centred so nothing hugs the left
 * edge on a wide monitor.
 *
 * - `wide`    lists, tables, dashboards — use the whole frame
 * - `medium`  a record with a side panel (sale, customer, backup)
 * - `narrow`  forms and feeds people read top to bottom (settings, notifications)
 * - `compact` a single task done in steps (new sale, opening a link)
 */
const SIZES = {
  wide: 'max-w-7xl',
  medium: 'max-w-5xl',
  narrow: 'max-w-3xl',
  compact: 'max-w-2xl',
} as const;

export type PageSize = keyof typeof SIZES;

export function Page({
  size = 'wide',
  className,
  children,
}: {
  size?: PageSize;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('mx-auto w-full', SIZES[size], className)}>{children}</div>;
}
