import { getTranslations } from 'next-intl/server';
import { ListPageSkeleton } from '@/components/ui/skeleton';

export default async function Loading() {
  const t = await getTranslations('common');
  return <ListPageSkeleton label={t('loading')} size="medium" tiles={false} />;
}
