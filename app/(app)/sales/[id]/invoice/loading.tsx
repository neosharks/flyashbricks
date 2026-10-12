import { getTranslations } from 'next-intl/server';
import { LoadingRegion, PageHeaderSkeleton, Skeleton } from '@/components/ui/skeleton';
import { Page } from '@/components/ui/page';

export default async function Loading() {
  const t = await getTranslations('common');
  return (
    <LoadingRegion label={t('loading')}>
      <Page size="medium">
        <PageHeaderSkeleton />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </Page>
    </LoadingRegion>
  );
}
