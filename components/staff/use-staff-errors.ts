'use client';

import { useTranslations } from 'next-intl';
import { translateDynamic } from '@/lib/i18n-dynamic';

/**
 * Field errors arrive translated from the shared validation messages; the few
 * that only staff screens produce come back as keys and are translated here.
 */
export function useStaffErrors() {
  const t = useTranslations('staff.validation');
  return (message: string | undefined): string | undefined =>
    message === undefined ? undefined : translateDynamic(t, message, message);
}
