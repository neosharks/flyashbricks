import type { Metadata } from 'next';
import { CustomerDetail } from '@/components/customers/customer-detail';

export const metadata: Metadata = { title: 'Customer' };

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <CustomerDetail id={id} query={query} />;
}
