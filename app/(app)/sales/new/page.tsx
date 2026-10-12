import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/page-header';
import { NewSaleForm } from '@/components/sales/new-sale-form';
import { getCustomerOption } from '@/features/customers/queries';
import { getOrgSummary } from '@/lib/org';
import { listProductOptions } from '@/features/sales/queries';
import { todayKey } from '@/lib/dates';
import { requirePermissionPage } from '@/lib/session';
import { Page } from '@/components/ui/page';

export const metadata: Metadata = { title: 'New sale' };

export default async function NewSalePage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const viewer = await requirePermissionPage('/sales/new', 'sales:write');
  const { customer } = await searchParams;
  const [t, org, products, initialCustomer] = await Promise.all([
    getTranslations('sales'),
    getOrgSummary(viewer.orgId),
    listProductOptions(viewer),
    customer ? getCustomerOption(viewer, customer) : Promise.resolve(null),
  ]);

  return (
    <Page size="compact">
      <PageHeader
        title={t('form.title')}
        description={t('form.description')}
        back={{ href: '/sales', label: t('title') }}
      />
      <NewSaleForm
        products={products}
        today={todayKey(org.timezone)}
        initialCustomer={initialCustomer}
        org={{ registered: org.registered, gstRateBps: org.gstRateBps, stateCode: org.stateCode }}
      />
    </Page>
  );
}
