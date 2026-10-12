import { getTranslations } from 'next-intl/server';
import { FormPageSkeleton } from '@/components/ui/skeleton';

export default async function Loading() {
  const t = await getTranslations('common');
  return <FormPageSkeleton label={t('loading')} />;
}
