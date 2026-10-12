import { getTranslations } from 'next-intl/server';
import {
  ChartSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from '@/components/ui/skeleton';

export default async function Loading() {
  const t = await getTranslations('common');
  return (
    <LoadingRegion label={t('loading')}>
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <div className="mt-6">
        <ChartSkeleton />
      </div>
      <div className="mt-6">
        <TableSkeleton />
      </div>
    </LoadingRegion>
  );
}
