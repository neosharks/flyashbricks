import { getTranslations } from 'next-intl/server';
import { DetailPageSkeleton } from '@/components/ui/skeleton';

export default async function Loading() {
  const t = await getTranslations('common');
  return <DetailPageSkeleton label={t('loading')} />;
}
