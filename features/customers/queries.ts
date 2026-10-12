import 'server-only';
import { Types, type QueryFilter } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { dateToIso, idToString } from '@/lib/dto';
import type { SessionUser } from '@/lib/permissions';
import { keysetPage, type Page, type TableParams } from '@/lib/table';
import { escapeRegex } from '@/lib/utils';
import { pickText } from '@/lib/bilingual';
import { requestLocale } from '@/lib/locale';
import { Customer, type CustomerDoc } from '@/models/customer';
import { addDays, DEFAULT_TIMEZONE, startOfDay, startOfMonthKey, todayKey } from '@/lib/dates';
import {
  DUES_BRACKETS,
  RECENCY_BUCKETS,
  type CustomerGroup,
  type CustomerGroupRow,
  type CustomerOption,
  type CustomerRow,
  type DuesBracket,
  type RecencyBucket,
} from './types';

export const CUSTOMER_SORTS = [
  'name',
  'duePaise',
  'createdAt',
  'lastSaleAt',
  'bricksBought',
] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export function toCustomerRow(doc: CustomerDoc, locale: 'en' | 'hi' = 'en'): CustomerRow {
  return {
    id: idToString(doc._id),
    name: pickText(doc.name, doc.nameHi, locale),
    nameEn: doc.name,
    nameHi: doc.nameHi ?? null,
    phones: doc.phones,
    address: pickText(doc.address, doc.addressHi, locale) || null,
    addressEn: doc.address,
    addressHi: doc.addressHi ?? null,
    city: pickText(doc.city, doc.cityHi, locale) || null,
    cityEn: doc.city,
    cityHi: doc.cityHi ?? null,
    gstin: doc.gstin,
    stateCode: doc.stateCode,
    notes: doc.notes,
    billedPaise: doc.billedPaise,
    paidPaise: doc.paidPaise,
    duePaise: doc.duePaise,
    bricksBought: doc.bricksBought,
    saleCount: doc.saleCount,
    lastSaleAt: doc.lastSaleAt ? dateToIso(doc.lastSaleAt) : null,
    createdAt: dateToIso(doc.createdAt),
  };
}

/**
 * Every word typed must prefix-match one of the customer's search terms (name
 * words, city, phone digits). Anchored, so the multikey index serves it.
 */
export function customerSearchFilter(q: string): QueryFilter<CustomerDoc> | null {
  const words = q
    .normalize('NFKC')
    .toLowerCase()
    .split(/[\s,]+/)
    .map((word) =>
      /^[+\d\s-]+$/.test(word) ? word.replace(/\D/g, '').replace(/^91(?=\d{10})/, '') : word,
    )
    .filter(Boolean)
    .slice(0, 5);
  if (words.length === 0) return null;
  return { $and: words.map((word) => ({ searchTerms: { $regex: `^${escapeRegex(word)}` } })) };
}

/** Rupee edges of the dues brackets, in paise. */
const DUES_EDGES = { tenK: 1_000_000, fiftyK: 5_000_000 } as const;

function duesFilter(bracket: DuesBracket): QueryFilter<CustomerDoc> {
  switch (bracket) {
    case 'none':
      return { duePaise: { $lte: 0 } };
    case 'upto10k':
      return { duePaise: { $gt: 0, $lte: DUES_EDGES.tenK } };
    case 'from10kTo50k':
      return { duePaise: { $gt: DUES_EDGES.tenK, $lte: DUES_EDGES.fiftyK } };
    case 'over50k':
      return { duePaise: { $gt: DUES_EDGES.fiftyK } };
  }
}

/** Month boundaries for "last bought": this month, the three before, and earlier. */
function recencyEdges(timeZone: string, now = new Date()) {
  const thisMonth = startOfMonthKey(todayKey(timeZone, now));
  let threeBack = thisMonth;
  for (let step = 0; step < 3; step += 1) threeBack = startOfMonthKey(addDays(threeBack, -1));
  return { thisMonth: startOfDay(thisMonth, timeZone), threeBack: startOfDay(threeBack, timeZone) };
}

function recencyFilter(bucket: RecencyBucket, timeZone: string): QueryFilter<CustomerDoc> {
  const edges = recencyEdges(timeZone);
  switch (bucket) {
    case 'thisMonth':
      return { lastSaleAt: { $gte: edges.thisMonth } };
    case 'oneToThree':
      return { lastSaleAt: { $gte: edges.threeBack, $lt: edges.thisMonth } };
    case 'older':
      return { lastSaleAt: { $lt: edges.threeBack } };
    case 'never':
      return { lastSaleAt: null };
  }
}

export type CustomerListFilters = {
  dues: boolean;
  duesBracket: DuesBracket | null;
  recency: RecencyBucket | null;
  city: string | null;
};

type SearchParams = Record<string, string | string[] | undefined>;

export function parseCustomerFilters(query: SearchParams): CustomerListFilters {
  const read = (key: string) => (Array.isArray(query[key]) ? query[key][0] : query[key]);
  const bracket = read('bracket');
  const recency = read('recency');
  const city = read('city')?.trim().slice(0, 80);
  return {
    dues: read('dues') === '1',
    duesBracket: DUES_BRACKETS.find((value) => value === bracket) ?? null,
    recency: RECENCY_BUCKETS.find((value) => value === recency) ?? null,
    city: city !== undefined && city !== '' ? city : null,
  };
}

function customerFilter(
  viewer: SessionUser,
  filters: Partial<CustomerListFilters>,
  timeZone: string,
): QueryFilter<CustomerDoc> {
  const parts: QueryFilter<CustomerDoc>[] = [{ orgId: new Types.ObjectId(viewer.orgId) }];
  if (filters.dues) parts.push({ duePaise: { $gt: 0 } });
  if (filters.duesBracket) parts.push(duesFilter(filters.duesBracket));
  if (filters.recency) parts.push(recencyFilter(filters.recency, timeZone));
  if (filters.city) {
    // "—" is the group for customers with no city on file.
    parts.push(
      filters.city === '—'
        ? { city: null }
        : { city: { $regex: `^${escapeRegex(filters.city)}$`, $options: 'i' } },
    );
  }
  return parts.length === 1 ? (parts[0] ?? {}) : { $and: parts };
}

/** The list's whole query — filters, search and sort guard — shared with the CSV export. */
export function customerListFilter(
  viewer: SessionUser,
  filters: Partial<CustomerListFilters>,
  q: string,
  sort: CustomerSort,
  timeZone: string,
): QueryFilter<CustomerDoc> {
  const parts = [customerFilter(viewer, filters, timeZone)];
  // Keyset paging cannot compare nulls: sorting by last purchase lists buyers only.
  if (sort === 'lastSaleAt') parts.push({ lastSaleAt: { $ne: null } });
  const search = q ? customerSearchFilter(q) : null;
  if (search) parts.push(search);
  return parts.length === 1 ? (parts[0] ?? {}) : { $and: parts };
}

/** Filters not passed are not applied; the timezone only matters for "last purchase" filters. */
export async function listCustomers(
  viewer: SessionUser,
  params: TableParams<CustomerSort> & Partial<CustomerListFilters>,
  timeZone: string = DEFAULT_TIMEZONE,
): Promise<Page<CustomerRow>> {
  await connectDb();
  const query = customerListFilter(viewer, params, params.q, params.sort, timeZone);

  const [page, locale] = await Promise.all([keysetPage(Customer, query, params), requestLocale()]);
  return { ...page, rows: page.rows.map((doc) => toCustomerRow(doc, locale)) };
}

export async function customerStats(viewer: SessionUser) {
  await connectDb();
  const [row] = await Customer.aggregate<{
    customers: number;
    receivablePaise: number;
    withDues: number;
  }>([
    { $match: { orgId: new Types.ObjectId(viewer.orgId) } },
    {
      $group: {
        _id: null,
        customers: { $sum: 1 },
        receivablePaise: { $sum: { $max: ['$duePaise', 0] } },
        withDues: { $sum: { $cond: [{ $gt: ['$duePaise', 0] }, 1, 0] } },
      },
    },
  ]);
  return row ?? { customers: 0, receivablePaise: 0, withDues: 0 };
}

export async function getCustomer(viewer: SessionUser, id: string): Promise<CustomerRow | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDb();
  const [doc, locale] = await Promise.all([
    Customer.findOne({ _id: id, orgId: viewer.orgId }).lean(),
    requestLocale(),
  ]);
  return doc ? toCustomerRow(doc, locale) : null;
}

/** Up to eight matches for the sale form's picker; dues first so they are noticed. */
export async function searchCustomerOptions(
  viewer: SessionUser,
  q: string,
): Promise<CustomerOption[]> {
  await connectDb();
  const filter: QueryFilter<CustomerDoc> = { orgId: new Types.ObjectId(viewer.orgId) };
  const search = q ? customerSearchFilter(q) : null;
  const [rows, locale] = await Promise.all([
    Customer.find(search ? { $and: [filter, search] } : filter)
      .select('name nameHi phones city cityHi duePaise stateCode gstin')
      .sort(search ? { name: 1 } : { lastSaleAt: -1 })
      .limit(8)
      .maxTimeMS(3_000)
      .lean(),
    requestLocale(),
  ]);
  return rows.map((row) => ({
    id: idToString(row._id),
    name: pickText(row.name, row.nameHi, locale),
    phone: row.phones[0] ?? '',
    city: pickText(row.city, row.cityHi, locale) || null,
    duePaise: row.duePaise,
    stateCode: row.stateCode,
    gstin: row.gstin,
  }));
}

export async function getCustomerOption(
  viewer: SessionUser,
  id: string,
): Promise<CustomerOption | null> {
  const row = await getCustomer(viewer, id);
  return row
    ? {
        id: row.id,
        name: row.name,
        phone: row.phones[0] ?? '',
        city: row.city,
        duePaise: row.duePaise,
        stateCode: row.stateCode,
        gstin: row.gstin,
      }
    : null;
}

/**
 * "Group by" for the customers list: by city, by how much they owe, or by
 * how recently they last bought. Bounded by the organisation's customers.
 */
export async function groupCustomers(
  viewer: SessionUser,
  filters: CustomerListFilters,
  q: string,
  timeZone: string,
  by: CustomerGroup,
): Promise<CustomerGroupRow[]> {
  await connectDb();
  const base = customerFilter(viewer, filters, timeZone);
  const search = q ? customerSearchFilter(q) : null;
  const match = search ? { $and: [base, search] } : base;
  const edges = recencyEdges(timeZone);

  const key: Record<CustomerGroup, unknown> = {
    city: { $ifNull: ['$city', '—'] },
    dues: {
      $switch: {
        branches: [
          { case: { $lte: ['$duePaise', 0] }, then: 'none' },
          { case: { $lte: ['$duePaise', DUES_EDGES.tenK] }, then: 'upto10k' },
          { case: { $lte: ['$duePaise', DUES_EDGES.fiftyK] }, then: 'from10kTo50k' },
        ],
        default: 'over50k',
      },
    },
    recency: {
      $switch: {
        branches: [
          { case: { $eq: [{ $ifNull: ['$lastSaleAt', null] }, null] }, then: 'never' },
          { case: { $gte: ['$lastSaleAt', edges.thisMonth] }, then: 'thisMonth' },
          { case: { $gte: ['$lastSaleAt', edges.threeBack] }, then: 'oneToThree' },
        ],
        default: 'older',
      },
    },
  };

  const rows = await Customer.aggregate<CustomerGroupRow & { _id: string }>([
    { $match: match },
    {
      $group: {
        _id: key[by],
        customers: { $sum: 1 },
        bills: { $sum: '$saleCount' },
        bricks: { $sum: '$bricksBought' },
        billedPaise: { $sum: '$billedPaise' },
        duePaise: { $sum: { $max: ['$duePaise', 0] } },
        keyHi: { $first: '$cityHi' },
      },
    },
    { $sort: { billedPaise: -1 } },
    { $limit: 400 },
  ]).option({ maxTimeMS: 5_000 });

  const mapped = rows.map(({ _id, ...row }) => ({ ...row, key: _id }));
  // Brackets read best in their natural order, not by size.
  const order: readonly string[] =
    by === 'dues' ? DUES_BRACKETS : by === 'recency' ? RECENCY_BUCKETS : [];
  return order.length > 0
    ? mapped.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    : mapped;
}
