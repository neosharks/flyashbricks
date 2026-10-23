import type { Metadata } from 'next';
import { MaterialDetail } from '@/components/raw-materials/material-detail';

export const metadata: Metadata = { title: 'Raw material' };

export default async function MaterialDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <MaterialDetail id={id} query={query} />;
}
