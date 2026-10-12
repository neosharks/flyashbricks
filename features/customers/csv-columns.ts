import { dayKey } from '@/lib/dates';
import { GST_STATES } from '@/lib/gst';
import { csvRupees } from '@/features/sales/csv';
import type { CustomerDoc } from '@/models/customer';

export type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Columns of the customers CSV. Names, cities and addresses go out in both
 * scripts, side by side, so the sheet works for whoever opens it.
 */
export function customerCsvColumns(t: Translate, tb: Translate, timeZone: string) {
  return {
    header: [
      t('columns.name'),
      tb('inHindi', { label: t('columns.name') }),
      t('form.phones'),
      t('columns.city'),
      tb('inHindi', { label: t('columns.city') }),
      t('form.address'),
      tb('inHindi', { label: t('form.address') }),
      t('form.state'),
      t('form.gstin'),
      `${t('columns.billed')} (₹)`,
      `${t('detail.paid')} (₹)`,
      `${t('columns.due')} (₹)`,
      t('detail.bricksBought'),
      t('detail.saleCount'),
      t('columns.lastSale'),
    ],
    toRow: (customer: CustomerDoc): (string | number | null)[] => [
      customer.name,
      customer.nameHi,
      customer.phones.join(' / '),
      customer.city,
      customer.cityHi,
      customer.address,
      customer.addressHi,
      customer.stateCode ? GST_STATES[customer.stateCode] : null,
      customer.gstin,
      csvRupees(customer.billedPaise),
      csvRupees(customer.paidPaise),
      csvRupees(customer.duePaise),
      customer.bricksBought,
      customer.saleCount,
      customer.lastSaleAt ? dayKey(customer.lastSaleAt, timeZone) : null,
    ],
  };
}
