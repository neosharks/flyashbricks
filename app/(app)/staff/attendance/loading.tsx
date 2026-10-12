import { getTranslations } from 'next-intl/server';
import { LoadingRegion, PageHeaderSkeleton, Skeleton } from '@/components/ui/skeleton';
import { Page } from '@/components/ui/page';

export default async function Loading() {
  const t = await getTranslations('common');
  return (
    <LoadingRegion label={t('loading')}>
      <Page size="narrow">
        <PageHeaderSkeleton />
        <Skeleton className="mb-4 h-11 w-56" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </Page>
    </LoadingRegion>
  );
}
