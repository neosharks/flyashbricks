import 'server-only';
import { Types, type ObjectId, type QueryFilter } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { addDays, startOfDay, todayKey } from '@/lib/dates';
import { dateToIso, idToString } from '@/lib/dto';
import type { SessionUser } from '@/lib/permissions';
import { decodeCursor, encodeCursor, keysetPage, type Page, type TableParams } from '@/lib/table';
import { escapeRegex } from '@/lib/utils';
import { pickText } from '@/lib/bilingual';
import { requestLocale } from '@/lib/locale';
import { Customer } from '@/models/customer';
import { Product } from '@/models/product';
import { Sale, type SaleDoc } from '@/models/sale';
import { AGEING_BUCKETS, PRICE_BAND_PAISE } from './totals';
import { resolveRange, type SalesFilters } from './filters';
import type {
  AgeingRow,
  CustomerPaymentRow,
  CustomerPriceStats,
  ProductOption,
  SaleDetail,
  SaleGroup,
  SaleGroupRow,
  SaleRow,
  SalesSummary,
} from './types';

export const SALE_SORTS = [
  'date',
  'totalPaise',
  'duePaise',
  'customerName',
  'bricks',
  'avgRatePaise',
] as const;
export type SaleSort = (typeof SALE_SORTS)[number];

/** Matches the oldest ageing bucket ("over 60 days"). */
const OVERDUE_MS = 60 * 86_400_000;

export function toSaleRow(doc: SaleDoc, now = Date.now(), locale: 'en' | 'hi' = 'en'): SaleRow {
  return {
    id: idToString(doc._id),
    number: doc.number,
    customerId: idToString(doc.customerId),
    customerName: pickText(doc.customerName, doc.customerNameHi, locale),
    customerPhone: doc.customerPhone,
    date: dateToIso(doc.date),
    bricks: doc.bricks,
    avgRatePaise: doc.avgRatePaise,
    itemsSummary: doc.lines
      .map((line) => `${pickText(line.productName, line.productNameHi, locale)} × ${line.qty}`)
      .join(', '),
    totalPaise: doc.totalPaise,
    paidPaise: doc.paidPaise,
    duePaise: doc.duePaise,
    status: doc.status,
    voided: doc.voidedAt !== null,
    overdue: doc.voidedAt === null && doc.duePaise > 0 && now - doc.date.getTime() > OVERDUE_MS,
  };
}

function toDetail(doc: SaleDoc, locale: 'en' | 'hi'): SaleDetail {
  return {
    ...toSaleRow(doc, Date.now(), locale),
    lines: doc.lines.map((line) => ({
      productId: idToString(line.productId),
      productName: pickText(line.productName, line.productNameHi, locale),
      productNameEn: line.productName,
      productNameHi: line.productNameHi ?? null,
      qty: line.qty,
      ratePaise: line.ratePaise,
      defaultRatePaise: line.defaultRatePaise,
      amountPaise: line.amountPaise,
    })),
    subtotalPaise: doc.subtotalPaise,
    deliveryPaise: doc.deliveryPaise,
    discountPaise: doc.discountPaise,
    invoiceNumber: doc.invoiceNumber,
    // Older bills predate the Hindi fields; absent means "not recorded".
    seller: {
      ...doc.seller,
      nameHi: doc.seller.nameHi ?? null,
      addressHi: doc.seller.addressHi ?? null,
    },
    buyer: {
      ...doc.buyer,
      nameHi: doc.buyer.nameHi ?? null,
      addressHi: doc.buyer.addressHi ?? null,
    },
    taxablePaise: doc.taxablePaise,
    gstRateBps: doc.gstRateBps,
    cgstPaise: doc.cgstPaise,
    sgstPaise: doc.sgstPaise,
    igstPaise: doc.igstPaise,
    taxPaise: doc.taxPaise,
    payments: doc.payments
      .map((payment) => ({
        id: idToString(payment._id),
        amountPaise: payment.amountPaise,
        mode: payment.mode,
        paidAt: dateToIso(payment.paidAt),
        note: payment.note,
        recordedByName: payment.recordedByName,
      }))
      .reverse(),
    vehicleNo: doc.vehicleNo,
    deliveryAddress: doc.deliveryAddress,
    note: doc.note,
    voidedAt: doc.voidedAt ? dateToIso(doc.voidedAt) : null,
    voidReason: doc.voidReason,
    createdByName: doc.createdByName,
    createdAt: dateToIso(doc.createdAt),
  };
}

/**
 * The search box takes a sale number ("S-12", "12"), a phone number or the
 * start of a customer's name, and works out which from its shape.
 */
function searchFilter(q: string): QueryFilter<SaleDoc> | null {
  const text = q.trim();
  if (!text) return null;
  const number = /^s-?(\d{1,9})$/i.exec(text)?.[1] ?? (/^\d{1,5}$/.test(text) ? text : null);
  if (number) return { number: Number(number) };
  const digits = text.replace(/[\s+-]/g, '');
  if (/^\d{4,12}$/.test(digits)) {
    return { customerPhone: { $regex: `^${escapeRegex(digits.replace(/^91(?=\d{10})/, ''))}` } };
  }
  // Either script: the name as typed in English or in Hindi.
  const prefix = { $regex: `^${escapeRegex(text)}`, $options: 'i' };
  return { $or: [{ customerName: prefix }, { customerNameHi: prefix }] };
}

export function salesFilter(
  viewer: SessionUser,
  filters: SalesFilters,
  q: string,
  timeZone: string,
  options: { includeStatus?: boolean } = {},
): QueryFilter<SaleDoc> {
  const filter: QueryFilter<SaleDoc> = { orgId: new Types.ObjectId(viewer.orgId) };

  if (filters.from || filters.to) {
    filter.date = {
      ...(filters.from ? { $gte: startOfDay(filters.from, timeZone) } : {}),
      ...(filters.to ? { $lt: startOfDay(addDays(filters.to, 1), timeZone) } : {}),
    };
  }
  if (filters.customerId) filter.customerId = new Types.ObjectId(filters.customerId);
  if (filters.productId) filter['lines.productId'] = new Types.ObjectId(filters.productId);
  if (filters.rateBand !== null) {
    filter.avgRatePaise = { $gte: filters.rateBand, $lt: filters.rateBand + PRICE_BAND_PAISE };
  }

  if (options.includeStatus !== false) {
    switch (filters.status) {
      case 'voided':
        filter.voidedAt = { $ne: null };
        break;
      case 'due':
        filter.voidedAt = null;
        filter.duePaise = { $gt: 0 };
        break;
      case 'unpaid':
      case 'partial':
      case 'paid':
        filter.voidedAt = null;
        filter.status = filters.status;
        break;
      case null:
        break;
    }
  }

  const search = searchFilter(q);
  return search ? { $and: [filter, search] } : filter;
}

export async function listSales(
  viewer: SessionUser,
  params: TableParams<SaleSort>,
  filters: SalesFilters,
  timeZone: string,
): Promise<Page<SaleRow>> {
  await connectDb();
  const [page, locale] = await Promise.all([
    keysetPage(Sale, salesFilter(viewer, filters, params.q, timeZone), params),
    requestLocale(),
  ]);
  const now = Date.now();
  return { ...page, rows: page.rows.map((doc) => toSaleRow(doc, now, locale)) };
}

const SUMMARY_GROUP = {
  _id: null,
  count: { $sum: 1 },
  bricks: { $sum: '$bricks' },
  subtotalPaise: { $sum: '$subtotalPaise' },
  totalPaise: { $sum: '$totalPaise' },
  paidPaise: { $sum: '$paidPaise' },
  duePaise: { $sum: '$duePaise' },
  minRatePaise: { $min: '$avgRatePaise' },
  maxRatePaise: { $max: '$avgRatePaise' },
} as const;

const EMPTY_SUMMARY: SalesSummary = {
  count: 0,
  bricks: 0,
  subtotalPaise: 0,
  totalPaise: 0,
  paidPaise: 0,
  duePaise: 0,
  minRatePaise: 0,
  maxRatePaise: 0,
};

/** Totals for whatever the list is filtered to. Voided sales never count. */
export async function summarizeSales(
  viewer: SessionUser,
  filters: SalesFilters,
  q: string,
  timeZone: string,
): Promise<SalesSummary> {
  await connectDb();
  const match = { $and: [salesFilter(viewer, filters, q, timeZone), { voidedAt: null }] };
  const [row] = await Sale.aggregate<SalesSummary>([
    { $match: match },
    { $group: SUMMARY_GROUP },
    { $project: { _id: 0 } },
  ]).option({ maxTimeMS: 5_000 });
  return row ?? EMPTY_SUMMARY;
}

/** This week and this month, regardless of the list's filters. */
export async function periodStats(
  viewer: SessionUser,
  timeZone: string,
): Promise<{ week: SalesSummary; month: SalesSummary }> {
  const period = (range: 'week' | 'month'): SalesFilters => ({
    range,
    status: null,
    customerId: null,
    productId: null,
    rateBand: null,
    ...resolveRange(range, { from: null, to: null }, timeZone),
  });
  const [week, month] = await Promise.all([
    summarizeSales(viewer, period('week'), '', timeZone),
    summarizeSales(viewer, period('month'), '', timeZone),
  ]);
  return { week, month };
}

/** Unpaid balances by how long they have been outstanding. */
export async function receivablesAgeing(
  viewer: SessionUser,
  timeZone: string,
): Promise<AgeingRow[]> {
  await connectDb();
  const today = todayKey(timeZone);
  const boundary = (days: number) => startOfDay(addDays(today, -days), timeZone);

  const rows = await Sale.aggregate<{ _id: AgeingRow['bucket']; duePaise: number; count: number }>([
    { $match: { orgId: new Types.ObjectId(viewer.orgId), voidedAt: null, duePaise: { $gt: 0 } } },
    {
      $group: {
        _id: {
          $switch: {
            branches: [
              { case: { $gte: ['$date', boundary(7)] }, then: 'd0_7' },
              { case: { $gte: ['$date', boundary(30)] }, then: 'd8_30' },
              { case: { $gte: ['$date', boundary(60)] }, then: 'd31_60' },
            ],
            default: 'd60',
          },
        },
        duePaise: { $sum: '$duePaise' },
        count: { $sum: 1 },
      },
    },
  ]).option({ maxTimeMS: 5_000 });

  return AGEING_BUCKETS.map((bucket) => {
    const row = rows.find((candidate) => candidate._id === bucket);
    return { bucket, duePaise: row?.duePaise ?? 0, count: row?.count ?? 0 };
  });
}

/** Sales value per day for the last `days` days, oldest first, gaps filled with zero. */
export async function dailySales(
  viewer: SessionUser,
  timeZone: string,
  days = 30,
): Promise<{ day: string; totalPaise: number; bricks: number; avgRatePaise: number }[]> {
  await connectDb();
  const today = todayKey(timeZone);
  const start = addDays(today, -(days - 1));

  const rows = await Sale.aggregate<{
    _id: string;
    totalPaise: number;
    bricks: number;
    subtotalPaise: number;
  }>([
    {
      $match: {
        orgId: new Types.ObjectId(viewer.orgId),
        voidedAt: null,
        date: { $gte: startOfDay(start, timeZone) },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: timeZone } },
        totalPaise: { $sum: '$totalPaise' },
        bricks: { $sum: '$bricks' },
        subtotalPaise: { $sum: '$subtotalPaise' },
      },
    },
  ]).option({ maxTimeMS: 5_000 });

  const byDay = new Map(rows.map((row) => [row._id, row]));
  return Array.from({ length: days }, (_, index) => {
    const day = addDays(start, index);
    const row = byDay.get(day);
    return {
      day,
      totalPaise: row?.totalPaise ?? 0,
      bricks: row?.bricks ?? 0,
      avgRatePaise: row && row.bricks > 0 ? Math.round(row.subtotalPaise / row.bricks) : 0,
    };
  });
}

export async function getSale(viewer: SessionUser, id: string): Promise<SaleDetail | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDb();
  const [doc, locale] = await Promise.all([
    Sale.findOne({ _id: id, orgId: viewer.orgId }).lean(),
    requestLocale(),
  ]);
  return doc ? toDetail(doc, locale) : null;
}

export async function listProductOptions(viewer: SessionUser): Promise<ProductOption[]> {
  await connectDb();
  const [rows, locale] = await Promise.all([
    Product.find({ orgId: viewer.orgId, isActive: true })
      .select('name nameHi size stockGood defaultRatePaise')
      .sort({ name: 1 })
      .lean(),
    requestLocale(),
  ]);
  return rows.map((row) => ({
    id: idToString(row._id),
    name: pickText(row.name, row.nameHi, locale),
    size: row.size,
    stockGood: row.stockGood,
    defaultRatePaise: row.defaultRatePaise,
  }));
}

/** What this customer usually pays per brick, and what they paid last time. */
export async function customerPriceStats(
  viewer: SessionUser,
  customerId: string,
): Promise<CustomerPriceStats> {
  await connectDb();
  const match = {
    orgId: new Types.ObjectId(viewer.orgId),
    customerId: new Types.ObjectId(customerId),
    voidedAt: null,
  };
  const [totals, last] = await Promise.all([
    Sale.aggregate<{ subtotalPaise: number; bricks: number }>([
      { $match: match },
      {
        $group: {
          _id: null,
          subtotalPaise: { $sum: '$subtotalPaise' },
          bricks: { $sum: '$bricks' },
        },
      },
    ]).option({ maxTimeMS: 5_000 }),
    Sale.findOne(match).sort({ date: -1, _id: -1 }).select('avgRatePaise date').lean(),
  ]);
  const row = totals[0];
  return {
    avgRatePaise: row && row.bricks > 0 ? Math.round(row.subtotalPaise / row.bricks) : null,
    lastRatePaise: last?.avgRatePaise ?? null,
    lastSaleAt: last ? dateToIso(last.date) : null,
  };
}

export const CUSTOMER_PAYMENT_SORTS = ['paidAt', 'amountPaise'] as const;
export type CustomerPaymentSort = (typeof CUSTOMER_PAYMENT_SORTS)[number];

type UnwoundPayment = { _id: ObjectId; number: number; payment: SaleDoc['payments'][number] };

/**
 * Money received from one customer, newest first by default, keyset-paged.
 * Payments live inside their sales, so the query unwinds them; the customer
 * match first uses the `{orgId, customerId, date}` index, and a customer has
 * at most a few hundred payments, so the unwound set stays small.
 */
export async function listCustomerPayments(
  viewer: SessionUser,
  customerId: string,
  params: TableParams<CustomerPaymentSort>,
): Promise<Page<CustomerPaymentRow>> {
  await connectDb();
  const ascending = params.dir === 'asc';
  const after = decodeCursor(params.after);
  const before = after ? null : decodeCursor(params.before);
  const walkAscending = before ? !ascending : ascending;
  const cursor = after ?? before;
  const field = `payment.${params.sort}`;
  const direction = walkAscending ? 1 : -1;
  const op = walkAscending ? '$gt' : '$lt';

  const rows = await Sale.aggregate<UnwoundPayment>([
    {
      $match: {
        orgId: new Types.ObjectId(viewer.orgId),
        customerId: new Types.ObjectId(customerId),
        voidedAt: null,
      },
    },
    { $unwind: '$payments' },
    { $project: { number: 1, payment: '$payments' } },
    ...(cursor
      ? [
          {
            $match: {
              $or: [
                { [field]: { [op]: cursor.v } },
                { [field]: cursor.v, 'payment._id': { [op]: new Types.ObjectId(cursor.id) } },
              ],
            },
          },
        ]
      : []),
    { $sort: { [field]: direction, 'payment._id': direction } },
    { $limit: params.size + 1 },
  ]).option({ maxTimeMS: 5_000 });

  const hasMore = rows.length > params.size;
  const page = hasMore ? rows.slice(0, params.size) : rows;
  if (before) page.reverse();

  const cursorOf = (row: UnwoundPayment | undefined): string | null =>
    row ? encodeCursor(row.payment[params.sort], row.payment._id.toString()) : null;

  return {
    rows: page.map((row) => ({
      id: idToString(row.payment._id),
      saleId: idToString(row._id),
      saleNumber: row.number,
      amountPaise: row.payment.amountPaise,
      mode: row.payment.mode,
      paidAt: dateToIso(row.payment.paidAt),
      note: row.payment.note,
      recordedByName: row.payment.recordedByName,
    })),
    next: before ? cursorOf(page.at(-1)) : hasMore ? cursorOf(page.at(-1)) : null,
    prev: before ? (hasMore ? cursorOf(page[0]) : null) : after ? cursorOf(page[0]) : null,
  };
}

const GROUP_LIMIT = 400;

/**
 * "Group by" for the sales list: one row of subtotals per day, week, month,
 * customer, brick type, payment status or price band, over exactly the sales
 * the list is filtered to. Brick-type groups unwind the lines, so their value
 * is the goods on that type's lines; a bill's money is not split by type.
 */
export async function groupSales(
  viewer: SessionUser,
  filters: SalesFilters,
  q: string,
  timeZone: string,
  by: SaleGroup,
): Promise<SaleGroupRow[]> {
  await connectDb();
  const locale = await requestLocale();
  // Cancelled bills only count when that is what the list is showing.
  const match =
    filters.status === 'voided'
      ? salesFilter(viewer, filters, q, timeZone)
      : { $and: [salesFilter(viewer, filters, q, timeZone), { voidedAt: null }] };

  if (by === 'product') {
    const rows = await Sale.aggregate<{
      _id: ObjectId;
      name: string;
      nameHi: string | null;
      bills: number;
      bricks: number;
      subtotalPaise: number;
    }>([
      { $match: match },
      { $unwind: '$lines' },
      ...(filters.productId
        ? [{ $match: { 'lines.productId': new Types.ObjectId(filters.productId) } }]
        : []),
      {
        $group: {
          _id: '$lines.productId',
          name: { $last: '$lines.productName' },
          nameHi: { $last: '$lines.productNameHi' },
          bills: { $sum: 1 },
          bricks: { $sum: '$lines.qty' },
          subtotalPaise: { $sum: '$lines.amountPaise' },
        },
      },
      { $sort: { subtotalPaise: -1 } },
      { $limit: GROUP_LIMIT },
    ]).option({ maxTimeMS: 5_000 });
    return rows.map((row) => ({
      key: row._id.toString(),
      name: pickText(row.name, row.nameHi, locale),
      bills: row.bills,
      bricks: row.bricks,
      subtotalPaise: row.subtotalPaise,
      totalPaise: null,
      paidPaise: null,
      duePaise: null,
    }));
  }

  const key: Record<Exclude<SaleGroup, 'product'>, unknown> = {
    day: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: timeZone } },
    week: {
      $dateToString: {
        format: '%Y-%m-%d',
        date: {
          $dateTrunc: { date: '$date', unit: 'week', startOfWeek: 'monday', timezone: timeZone },
        },
        timezone: timeZone,
      },
    },
    month: { $dateToString: { format: '%Y-%m', date: '$date', timezone: timeZone } },
    customer: '$customerId',
    status: { $cond: [{ $ne: ['$voidedAt', null] }, 'voided', '$status'] },
    price: {
      $multiply: [{ $floor: { $divide: ['$avgRatePaise', PRICE_BAND_PAISE] } }, PRICE_BAND_PAISE],
    },
  };
  const sortStage: Record<string, 1 | -1> =
    by === 'day' || by === 'week' || by === 'month'
      ? { _id: -1 }
      : by === 'price'
        ? { _id: 1 }
        : { totalPaise: -1 };

  const rows = await Sale.aggregate<{
    _id: string | number | ObjectId;
    name: string | null;
    nameHi: string | null;
    bills: number;
    bricks: number;
    subtotalPaise: number;
    totalPaise: number;
    paidPaise: number;
    duePaise: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: key[by],
        name: by === 'customer' ? { $last: '$customerName' } : { $first: null },
        nameHi: by === 'customer' ? { $last: '$customerNameHi' } : { $first: null },
        bills: { $sum: 1 },
        bricks: { $sum: '$bricks' },
        subtotalPaise: { $sum: '$subtotalPaise' },
        totalPaise: { $sum: '$totalPaise' },
        paidPaise: { $sum: '$paidPaise' },
        duePaise: { $sum: '$duePaise' },
      },
    },
    { $sort: sortStage },
    { $limit: GROUP_LIMIT },
  ]).option({ maxTimeMS: 5_000 });

  return rows.map((row) => ({
    key: String(row._id),
    name: row.name === null ? null : pickText(row.name, row.nameHi, locale),
    bills: row.bills,
    bricks: row.bricks,
    subtotalPaise: row.subtotalPaise,
    totalPaise: row.totalPaise,
    paidPaise: row.paidPaise,
    duePaise: row.duePaise,
  }));
}

/** Billed value per month for the last twelve months, oldest first. */
export async function customerMonthly(
  viewer: SessionUser,
  customerId: string,
  timeZone: string,
): Promise<{ month: string; totalPaise: number; bricks: number }[]> {
  await connectDb();
  const today = todayKey(timeZone);
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - (11 - index));
    return date.toISOString().slice(0, 7);
  });

  const rows = await Sale.aggregate<{ _id: string; totalPaise: number; bricks: number }>([
    {
      $match: {
        orgId: new Types.ObjectId(viewer.orgId),
        customerId: new Types.ObjectId(customerId),
        voidedAt: null,
        date: { $gte: startOfDay(`${months[0] ?? today.slice(0, 7)}-01`, timeZone) },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: timeZone } },
        totalPaise: { $sum: '$totalPaise' },
        bricks: { $sum: '$bricks' },
      },
    },
  ]);
  const byMonth = new Map(rows.map((row) => [row._id, row]));
  return months.map((month) => ({
    month,
    totalPaise: byMonth.get(month)?.totalPaise ?? 0,
    bricks: byMonth.get(month)?.bricks ?? 0,
  }));
}

/** Names for the filter chips a group link leaves on the list. */
export async function salesFilterNames(
  viewer: SessionUser,
  filters: Pick<SalesFilters, 'customerId' | 'productId'>,
): Promise<{ customer: string | null; product: string | null }> {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const [customer, product, locale] = await Promise.all([
    filters.customerId
      ? Customer.findOne({ _id: filters.customerId, orgId }).select('name nameHi').lean()
      : null,
    filters.productId
      ? Product.findOne({ _id: filters.productId, orgId }).select('name nameHi').lean()
      : null,
    requestLocale(),
  ]);
  return {
    customer: customer ? pickText(customer.name, customer.nameHi, locale) : null,
    product: product ? pickText(product.name, product.nameHi, locale) : null,
  };
}
