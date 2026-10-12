import { cn } from '@/lib/utils';
import { Page, type PageSize } from './page';
import { BrickLoader } from './brick-loader';

/**
 * Skeletons mirror the dimensions of what replaces them; one the wrong size
 * moves the page when the real content lands.
 */
export function Skeleton({ className, ...props }: React.ComponentPropsWithRef<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('bg-surface-muted animate-pulse rounded-md', className)}
      {...props}
    />
  );
}

/** Wraps a skeleton block so assistive tech hears "loading" rather than nothing. */
export function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/**
 * The bricks being laid, centred above a page's skeleton: the shapes show
 * where content will land, the bricks show that it is on its way.
 */
function PageLoader() {
  return (
    <div className="mb-4 flex justify-center">
      <BrickLoader label="" size="sm" announce={false} />
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="border-border bg-surface rounded-lg border p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-8 w-28" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="border-border bg-surface overflow-hidden rounded-lg border">
      <div className="border-border bg-surface-muted flex gap-4 border-b p-3">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="border-border flex items-center gap-4 border-b p-3 last:border-0">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 'h-56' }: { height?: string }) {
  return (
    <div className="border-border bg-surface rounded-lg border p-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className={cn('mt-4 w-full', height)} />
    </div>
  );
}

/** The default `loading.tsx` shape: header, tiles, table — at the page's own width. */
export function ListPageSkeleton({
  label,
  tiles = true,
  size = 'wide',
}: {
  label: string;
  tiles?: boolean;
  size?: PageSize;
}) {
  return (
    <LoadingRegion label={label}>
      <Page size={size}>
        <PageLoader />
        <PageHeaderSkeleton />
        {tiles && <StatCardsSkeleton />}
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-11 w-full max-w-xs" />
          <TableSkeleton />
        </div>
      </Page>
    </LoadingRegion>
  );
}

/** A record page: header, a main column and a side panel. */
export function DetailPageSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion label={label}>
      <Page size="medium">
        <PageLoader />
        <PageHeaderSkeleton />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      </Page>
    </LoadingRegion>
  );
}

/** A form page: header and stacked fields, narrow and centred. */
export function FormPageSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion label={label}>
      <Page size="narrow">
        <PageLoader />
        <PageHeaderSkeleton />
        <div className="border-border bg-surface flex flex-col gap-5 rounded-lg border p-6">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </div>
      </Page>
    </LoadingRegion>
  );
}
