import type { Metadata } from 'next';
import { UserDetail } from '@/components/users/user-detail';

export const metadata: Metadata = { title: 'Employee' };

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <UserDetail id={id} query={query} />;
}
