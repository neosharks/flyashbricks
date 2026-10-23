import type { Metadata } from 'next';
import { QuickProduction } from '@/components/quick/quick-production';
import { productionOptions } from '@/features/production/queries';
import { todayKey } from '@/lib/dates';
import { getOrgTimezone } from '@/lib/org';
import { requirePermissionPage } from '@/lib/session';

export const metadata: Metadata = { title: 'Bricks made' };

export default async function QuickProductionPage() {
  const user = await requirePermissionPage('/quick/production', 'production:write');
  const [products, timezone] = await Promise.all([
    productionOptions(user),
    getOrgTimezone(user.orgId),
  ]);
  return <QuickProduction products={products} today={todayKey(timezone)} />;
}
