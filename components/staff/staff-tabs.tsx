import { getTranslations } from 'next-intl/server';
import { LinkTabs } from '@/components/ui/tabs';

/** People, the daily sheet, wages and money paid are one area; the tabs move between them. */
export async function StaffTabs({
  current,
}: {
  current: 'people' | 'attendance' | 'payroll' | 'payments';
}) {
  const t = await getTranslations('staff.tabs');
  return (
    <LinkTabs
      label={t('label')}
      current={current}
      tabs={[
        { id: 'people', href: '/staff', label: t('people') },
        { id: 'attendance', href: '/staff/attendance', label: t('attendance') },
        { id: 'payroll', href: '/staff/payroll', label: t('payroll') },
        { id: 'payments', href: '/staff/payments', label: t('payments') },
      ]}
    />
  );
}
