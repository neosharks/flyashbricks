import { getTranslations } from 'next-intl/server';
import { LoadingRegion, PageHeaderSkeleton, Skeleton } from '@/components/ui/skeleton';

export default async function Loading() {
  const t = await getTranslations('common');
  return (
    <LoadingRegion label={t('loading')}>
      <div className="mx-auto w-full max-w-3xl">
        <PageHeaderSkeleton />
        <Skeleton className="mb-4 h-9 w-56" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex gap-3 p-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
