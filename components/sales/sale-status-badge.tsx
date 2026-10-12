import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import type { PaymentStatus } from '@/models/constants';

const TONES = { unpaid: 'danger', partial: 'warning', paid: 'success' } as const;

export async function SaleStatusBadge({
  status,
  voided,
}: {
  status: PaymentStatus;
  voided: boolean;
}) {
  const t = await getTranslations('sales.status');
  if (voided) return <Badge tone="neutral">{t('voided')}</Badge>;
  return <Badge tone={TONES[status]}>{t(status)}</Badge>;
}
