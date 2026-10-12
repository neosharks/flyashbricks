import { getTranslations } from 'next-intl/server';
import { connectDb } from '@/lib/db';
import { dayKey } from '@/lib/dates';
import { parseTableParams } from '@/lib/table';
import { csvResponse, exportGate, MAX_EXPORT_ROWS } from '@/features/sales/export';
import { getOrgTimezone } from '@/lib/org';
import {
  CUSTOMER_SORTS,
  customerListFilter,
  parseCustomerFilters,
} from '@/features/customers/queries';
import { Customer } from '@/models/customer';
import { customerCsvColumns, type Translate } from '@/features/customers/csv-columns';

export const dynamic = 'force-dynamic';

/** The customer list as CSV, with the screen's search, filters and order. */
export async function GET(request: Request): Promise<Response> {
  const gate = await exportGate();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  await connectDb();
  const query = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = parseCustomerFilters(query);
  const dues = filters.dues;
  const params = parseTableParams(query, CUSTOMER_SORTS, {
    sort: dues ? 'duePaise' : 'name',
    dir: dues ? 'desc' : 'asc',
  });
  const [t, tb, timeZone] = await Promise.all([
    getTranslations('customers'),
    getTranslations('common.bilingual'),
    getOrgTimezone(user.orgId),
  ]);

  const direction = params.dir === 'asc' ? 1 : -1;

  const cursor = Customer.find(customerListFilter(user, filters, params.q, params.sort, timeZone))
    .sort({ [params.sort]: direction, _id: direction })
    .limit(MAX_EXPORT_ROWS)
    .lean()
    .cursor();

  return csvResponse({
    user,
    action: 'customer.export',
    entity: 'Customer',
    filename: `customers-${dayKey(new Date(), timeZone)}.csv`,
    filters: { q: params.q, ...filters },
    cursor,
    ...customerCsvColumns(t as unknown as Translate, tb as unknown as Translate, timeZone),
  });
}
