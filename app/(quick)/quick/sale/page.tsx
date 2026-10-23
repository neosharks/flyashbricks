import type { Metadata } from 'next';
import { QuickSale } from '@/components/quick/quick-sale';
import { listProductOptions } from '@/features/sales/queries';
import { todayKey } from '@/lib/dates';
import { getOrgSummary } from '@/lib/org';
import { requirePermissionPage } from '@/lib/session';

export const metadata: Metadata = { title: 'New sale' };

export default async function QuickSalePage() {
  const user = await requirePermissionPage('/quick/sale', 'sales:write');
  const [org, products] = await Promise.all([getOrgSummary(user.orgId), listProductOptions(user)]);
  return (
    <QuickSale
      products={products}
      today={todayKey(org.timezone)}
      org={{ registered: org.registered, gstRateBps: org.gstRateBps, stateCode: org.stateCode }}
    />
  );
}
