import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { staffPaidByMonth } from '@/features/staff/payments-report';
import type { SessionUser } from '@/lib/permissions';
import { PaymentsChart } from './payments-chart';

/** One person's last twelve months of pay, stacked by type, linking to their full payment list. */
export async function StaffPaidChart({
  viewer,
  staffId,
  timeZone,
}: {
  viewer: SessionUser;
  staffId: string;
  timeZone: string;
}) {
  const [t, buckets] = await Promise.all([
    getTranslations('staff.paidChart'),
    staffPaidByMonth(viewer, staffId, timeZone),
  ]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t('title')}</CardTitle>
        <Link
          href={`/staff/payments?staff=${staffId}&period=year`}
          className="text-action -my-3 inline-flex min-h-11 items-center text-sm font-medium"
        >
          {t('seeAll')}
        </Link>
      </CardHeader>
      <CardBody>
        <PaymentsChart title={t('title')} buckets={buckets} unit="month" emptyLabel={t('empty')} />
      </CardBody>
    </Card>
  );
}
