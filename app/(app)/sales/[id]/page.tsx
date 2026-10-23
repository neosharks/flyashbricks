import type { Metadata } from 'next';
import { SaleDetail } from '@/components/sales/sale-detail';

export const metadata: Metadata = { title: 'Sale' };

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SaleDetail id={id} />;
}
