import { getTranslations } from 'next-intl/server';
import { LoadingRegion, PageHeaderSkeleton, Skeleton } from '@/components/ui/skeleton';

export default async function Loading() {
  const t = await getTranslations('common');
  return (
    <LoadingRegion label={t('loading')}>
      <div className="mx-auto w-full max-w-3xl">
        <PageHeaderSkeleton />
        <div className="flex flex-col gap-6">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
