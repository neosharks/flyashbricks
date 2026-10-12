import { getTranslations } from 'next-intl/server';
import {
  ChartSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  Skeleton,
  TableSkeleton,
} from '@/components/ui/skeleton';
import { Page } from '@/components/ui/page';

export default async function Loading() {
  const t = await getTranslations('common');
  return (
    <LoadingRegion label={t('loading')}>
      <Page size="medium">
        <PageHeaderSkeleton />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Skeleton className="h-80 rounded-lg" />
          <ChartSkeleton />
        </div>
        <div className="mt-8">
          <TableSkeleton />
        </div>
      </Page>
    </LoadingRegion>
  );
}
