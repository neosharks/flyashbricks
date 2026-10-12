import { getTranslations } from 'next-intl/server';
import {
  LoadingRegion,
  PageHeaderSkeleton,
  Skeleton,
  StatCardsSkeleton,
} from '@/components/ui/skeleton';

export default async function Loading() {
  const t = await getTranslations('common');
  return (
    <LoadingRegion label={t('loading')}>
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={3} />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-72 rounded-lg" />
        ))}
      </div>
    </LoadingRegion>
  );
}
