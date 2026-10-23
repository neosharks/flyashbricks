import type { Metadata } from 'next';
import { QuickPurchase } from '@/components/quick/quick-purchase';
import { materialOptions } from '@/features/raw-materials/queries';
import { todayKey } from '@/lib/dates';
import { getOrgTimezone } from '@/lib/org';
import { requirePermissionPage } from '@/lib/session';

export const metadata: Metadata = { title: 'Material arrived' };

export default async function QuickPurchasePage() {
  const user = await requirePermissionPage('/quick/purchase', 'rawMaterials:write');
  const [materials, timezone] = await Promise.all([
    materialOptions(user),
    getOrgTimezone(user.orgId),
  ]);
  return <QuickPurchase materials={materials} today={todayKey(timezone)} />;
}
