'use client';

import { useTranslations } from 'next-intl';
import { translateDynamic } from '@/lib/i18n-dynamic';

/**
 * Field errors arrive translated from the shared validation messages; the few
 * that only staff screens produce come back as keys and are translated here.
 * Pass it to `useActionForm` as `translate`.
 */
export function useStaffErrors() {
  const t = useTranslations('staff.validation');
  return (message: string): string => translateDynamic(t, message, message);
}
