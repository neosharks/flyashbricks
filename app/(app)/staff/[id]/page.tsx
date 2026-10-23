import type { Metadata } from 'next';
import { StaffDetail } from '@/components/staff/staff-detail';

export const metadata: Metadata = { title: 'Staff member' };

export default async function StaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <StaffDetail id={id} query={query} />;
}
