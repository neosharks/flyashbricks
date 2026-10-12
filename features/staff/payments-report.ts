import 'server-only';
import { Types, type ObjectId, type PipelineStage, type QueryFilter } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import {
  addDays,
  DAY_KEY_PATTERN,
  dayKey,
  dayRange,
  startOfDay,
  startOfMonthKey,
  startOfWeekKey,
  todayKey,
} from '@/lib/dates';
import { idToString } from '@/lib/dto';
import type { SessionUser } from '@/lib/permissions';
import {
  decodeCursor,
  encodeCursor,
  keysetFilter,
  keysetPage,
  type Page,
  type TableParams,
} from '@/lib/table';
import { escapeRegex } from '@/lib/utils';
import {
  PAYMENT_MODES,
  STAFF_PAYMENT_TYPES,
  STAFF_ROLES,
  type PaymentMode,
  type StaffPaymentType,
  type StaffRole,
} from '@/models/constants';
import { StaffMember, type StaffMemberDoc } from '@/models/staff-member';
import { StaffPayment, type StaffPaymentDoc } from '@/models/staff-payment';

/**
 * "Money paid" — what went out to the workforce over a period, modelled on the
 * sales list: period, filters, tiles, a chart, group-by and the payments table.
 *
 * Totals come from one aggregation per period (person × day × type × mode),
 * and every tile, chart bucket and group is folded from those rows in memory —
 * a plant's payments for a period are a few thousand rows at most. Cancelled
 * payments are excluded from every total and only shown, struck out, in the table.
 */

const MAX_TIME_MS = 5_000;
const MAX_STAFF = 2_000;
/** Above this many days the chart switches from daily to monthly columns. */
const DAILY_LIMIT = 62;

export const PAYMENT_PRESETS = ['week', 'month', 'lastMonth', 'last30', 'year', 'custom'] as const;
export type PaymentPreset = (typeof PAYMENT_PRESETS)[number];

export const PAYMENT_GROUPS = ['person', 'role', 'month', 'week', 'type', 'mode'] as const;
export type PaymentGroup = (typeof PAYMENT_GROUPS)[number];

export const PAYMENT_SORTS = ['paidOn', 'amountPaise', 'person'] as const;
export type PaymentSort = (typeof PAYMENT_SORTS)[number];

export type PaymentsFilters = {
  preset: PaymentPreset;
  from: string;
  to: string;
  staffId: string | null;
  role: StaffRole | null;
  type: StaffPaymentType | null;
  mode: PaymentMode | null;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Start of the Indian financial year (1 April) containing `day`. */
export function financialYearStart(day: string): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  return `${month >= 4 ? year : year - 1}-04-01`;
}

/** The period and filters in the URL. Anything malformed falls back to this month. */
export function parsePaymentsFilters(
  query: SearchParams,
  timeZone: string,
  now = new Date(),
): PaymentsFilters {
  const today = todayKey(timeZone, now);
  const preset = PAYMENT_PRESETS.find((candidate) => candidate === first(query.period)) ?? 'month';
  let from = startOfMonthKey(today);
  let to = today;

  switch (preset) {
    case 'week':
      from = startOfWeekKey(today);
      break;
    case 'lastMonth':
      to = addDays(startOfMonthKey(today), -1);
      from = startOfMonthKey(to);
      break;
    case 'last30':
      from = addDays(today, -29);
      break;
    case 'year':
      from = financialYearStart(today);
      break;
    case 'custom': {
      const rawFrom = first(query.from);
      const rawTo = first(query.to);
      if (
        rawFrom &&
        rawTo &&
        DAY_KEY_PATTERN.test(rawFrom) &&
        DAY_KEY_PATTERN.test(rawTo) &&
        rawFrom <= rawTo
      ) {
        from = rawFrom;
        to = rawTo > today ? today : rawTo;
      }
      break;
    }
    case 'month':
      break;
  }

  const staffId = first(query.staff);
  return {
    preset,
    from,
    to,
    staffId: staffId && /^[a-f\d]{24}$/i.test(staffId) ? staffId : null,
    role: STAFF_ROLES.find((candidate) => candidate === first(query.role)) ?? null,
    type: STAFF_PAYMENT_TYPES.find((candidate) => candidate === first(query.type)) ?? null,
    mode: PAYMENT_MODES.find((candidate) => candidate === first(query.mode)) ?? null,
  };
}

/** The same number of days immediately before, for "compared with before". */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const length = dayRange(from, to).length;
  return { from: addDays(from, -length), to: addDays(from, -1) };
}

export function bucketUnit(from: string, to: string): 'day' | 'month' {
  return dayRange(from, to).length > DAILY_LIMIT ? 'month' : 'day';
}

/** One aggregated row: a person's payments of one type and mode on one day. */
export type PaymentFact = {
  staffId: string;
  day: string;
  type: StaffPaymentType;
  mode: PaymentMode;
  amountPaise: number;
  count: number;
};

export type TypeTotals = Record<StaffPaymentType, number>;

const ZERO: TypeTotals = { wage: 0, advance: 0, bonus: 0, deduction: 0 };

/** Money that actually left the business: deductions are taken back, not paid out. */
export function paidOut(totals: TypeTotals): number {
  return totals.wage + totals.advance + totals.bonus;
}

export type PaymentsSummary = TypeTotals & {
  paidOut: number;
  payments: number;
  people: number;
  /** Paid out ÷ people paid; 0 when nobody was paid. */
  averagePerPerson: number;
};

export function summarizeFacts(facts: PaymentFact[]): PaymentsSummary {
  const totals = { ...ZERO };
  const people = new Set<string>();
  let payments = 0;
  for (const fact of facts) {
    totals[fact.type] += fact.amountPaise;
    payments += fact.count;
    if (fact.type !== 'deduction') people.add(fact.staffId);
  }
  const out = paidOut(totals);
  return {
    ...totals,
    paidOut: out,
    payments,
    people: people.size,
    averagePerPerson: people.size > 0 ? Math.round(out / people.size) : 0,
  };
}

export type PaymentBucket = TypeTotals & { key: string };

/** Chart columns: every day (or month) in the range, empty ones included. */
export function bucketFacts(
  facts: PaymentFact[],
  from: string,
  to: string,
  unit: 'day' | 'month',
): PaymentBucket[] {
  const keyOf = (day: string) => (unit === 'day' ? day : day.slice(0, 7));
  const keys = [...new Set(dayRange(from, to).map(keyOf))];
  const buckets = new Map<string, PaymentBucket>(keys.map((key) => [key, { key, ...ZERO }]));
  for (const fact of facts) {
    const bucket = buckets.get(keyOf(fact.day));
    if (bucket) bucket[fact.type] += fact.amountPaise;
  }
  return keys.map((key) => buckets.get(key) ?? { key, ...ZERO });
}

export type PaymentGroupRow = TypeTotals & { key: string; payments: number; net: number };

/**
 * "Group by": subtotals per person, role, month, week, type or mode. `net` is
 * money paid out less deductions taken back.
 */
export function groupFacts(
  facts: PaymentFact[],
  group: PaymentGroup,
  roleOf: (staffId: string) => StaffRole | null,
): PaymentGroupRow[] {
  const keyOf = (fact: PaymentFact): string => {
    switch (group) {
      case 'person':
        return fact.staffId;
      case 'role':
        return roleOf(fact.staffId) ?? 'other';
      case 'month':
        return fact.day.slice(0, 7);
      case 'week':
        return startOfWeekKey(fact.day);
      case 'type':
        return fact.type;
      case 'mode':
        return fact.mode;
    }
  };
  const rows = new Map<string, PaymentGroupRow>();
  for (const fact of facts) {
    const key = keyOf(fact);
    const row = rows.get(key) ?? { key, payments: 0, net: 0, ...ZERO };
    row[fact.type] += fact.amountPaise;
    row.payments += fact.count;
    rows.set(key, row);
  }
  return [...rows.values()]
    .map((row) => ({ ...row, net: paidOut(row) - row.deduction }))
    .sort((a, b) => b.net - a.net);
}

/**
 * The staff a role or name search narrows to, or null when neither is set.
 * Resolved first so the payments query stays on its own (org, date) index.
 */
async function staffScope(
  orgId: ObjectId,
  filters: PaymentsFilters,
  q: string,
): Promise<ObjectId[] | null> {
  if (filters.staffId) return [new Types.ObjectId(filters.staffId)];
  if (!filters.role && !q) return null;
  const filter: QueryFilter<StaffMemberDoc> = { orgId };
  if (filters.role) filter.role = filters.role;
  const words = q.normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  if (words.length > 0) {
    filter.$and = words.map((word) => ({ searchTerms: { $regex: `^${escapeRegex(word)}` } }));
  }
  const staff = await StaffMember.find(filter).select('_id').limit(MAX_STAFF).lean();
  return staff.map((member) => member._id);
}

function paymentsMatch(
  orgId: ObjectId,
  scope: ObjectId[] | null,
  filters: PaymentsFilters,
  range: { from: string; to: string },
  timeZone: string,
): QueryFilter<StaffPaymentDoc> {
  return {
    orgId,
    paidOn: {
      $gte: startOfDay(range.from, timeZone),
      $lt: startOfDay(addDays(range.to, 1), timeZone),
    },
    ...(scope ? { staffId: { $in: scope } } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.mode ? { mode: filters.mode } : {}),
  };
}

/** Live (not cancelled) payments in a range, folded to person × day × type × mode. */
export async function paymentFacts(
  viewer: SessionUser,
  filters: PaymentsFilters,
  q: string,
  range: { from: string; to: string },
  timeZone: string,
): Promise<PaymentFact[]> {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const scope = await staffScope(orgId, filters, q);
  if (scope?.length === 0) return [];

  const rows = await StaffPayment.aggregate<{
    _id: { staffId: ObjectId; day: string; type: StaffPaymentType; mode: PaymentMode };
    amountPaise: number;
    count: number;
  }>([
    { $match: { ...paymentsMatch(orgId, scope, filters, range, timeZone), voidedAt: null } },
    {
      $group: {
        _id: {
          staffId: '$staffId',
          day: { $dateToString: { date: '$paidOn', format: '%Y-%m-%d', timezone: timeZone } },
          type: '$type',
          mode: '$mode',
        },
        amountPaise: { $sum: '$amountPaise' },
        count: { $sum: 1 },
      },
    },
  ]).option({ maxTimeMS: MAX_TIME_MS });

  return rows.map((row) => ({
    staffId: row._id.staffId.toString(),
    day: row._id.day,
    type: row._id.type,
    mode: row._id.mode,
    amountPaise: row.amountPaise,
    count: row.count,
  }));
}

export type StaffBrief = {
  id: string;
  name: string;
  nameHi: string | null;
  role: StaffRole;
  photoAssetId: string | null;
};

/** Names, roles and photos for the people in a report — one query, never one per row. */
export async function staffBriefs(
  viewer: SessionUser,
  ids: string[],
): Promise<Map<string, StaffBrief>> {
  if (ids.length === 0) return new Map();
  await connectDb();
  const staff = await StaffMember.find({
    orgId: new Types.ObjectId(viewer.orgId),
    _id: { $in: [...new Set(ids)].map((id) => new Types.ObjectId(id)) },
  })
    .select('name nameHi role photoAssetId')
    .lean();
  return new Map(
    staff.map((member) => [
      member._id.toString(),
      {
        id: member._id.toString(),
        name: member.name,
        nameHi: member.nameHi,
        role: member.role,
        photoAssetId: member.photoAssetId ? idToString(member.photoAssetId) : null,
      },
    ]),
  );
}

export type PaymentListRow = {
  id: string;
  staff: StaffBrief | null;
  staffId: string;
  type: StaffPaymentType;
  amountPaise: number;
  mode: PaymentMode;
  paidOn: string;
  note: string | null;
  voided: boolean;
  voidReason: string | null;
  recordedByName: string;
};

/**
 * Sorting by person needs the person's name, which lives on the staff record:
 * that one order pages over an aggregation with a lookup; date and amount
 * page directly over the payments.
 */
async function pageByPerson(
  match: QueryFilter<StaffPaymentDoc>,
  params: TableParams<PaymentSort>,
): Promise<Page<StaffPaymentDoc & { personName: string }>> {
  const ascending = params.dir === 'asc';
  const after = decodeCursor(params.after);
  const before = after ? null : decodeCursor(params.before);
  const walkAscending = before ? !ascending : ascending;
  const cursor = after ?? before;
  const direction = walkAscending ? 1 : -1;

  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $lookup: {
        from: StaffMember.collection.name,
        localField: 'staffId',
        foreignField: '_id',
        pipeline: [{ $project: { name: 1 } }],
        as: 'staff',
      },
    },
    { $addFields: { personName: { $ifNull: [{ $first: '$staff.name' }, ''] } } },
    { $project: { staff: 0 } },
    ...(cursor
      ? [{ $match: keysetFilter('personName', walkAscending, cursor) } as PipelineStage]
      : []),
    { $sort: { personName: direction, _id: direction } },
    { $limit: params.size + 1 },
  ];
  const found = await StaffPayment.aggregate<StaffPaymentDoc & { personName: string }>(
    pipeline,
  ).option({
    maxTimeMS: MAX_TIME_MS,
  });

  const hasMore = found.length > params.size;
  const rows = hasMore ? found.slice(0, params.size) : found;
  if (before) rows.reverse();
  const cursorOf = (doc: (typeof rows)[number] | undefined) =>
    doc ? encodeCursor(doc.personName, doc._id.toString()) : null;
  return {
    rows,
    next: before ? cursorOf(rows.at(-1)) : hasMore ? cursorOf(rows.at(-1)) : null,
    prev: before ? (hasMore ? cursorOf(rows[0]) : null) : after ? cursorOf(rows[0]) : null,
  };
}

/** The payments table: every payment in the period, cancelled ones included (shown struck). */
export async function listPayments(
  viewer: SessionUser,
  filters: PaymentsFilters,
  params: TableParams<PaymentSort>,
  timeZone: string,
): Promise<Page<PaymentListRow>> {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const scope = await staffScope(orgId, filters, params.q);
  if (scope?.length === 0) return { rows: [], next: null, prev: null };

  const match = paymentsMatch(orgId, scope, filters, filters, timeZone);
  const page: Page<StaffPaymentDoc> =
    params.sort === 'person'
      ? await pageByPerson(match, params)
      : await keysetPage(StaffPayment, match, params);

  const briefs = await staffBriefs(
    viewer,
    page.rows.map((row) => row.staffId.toString()),
  );
  return {
    ...page,
    rows: page.rows.map((row) => ({
      id: idToString(row._id),
      staffId: row.staffId.toString(),
      staff: briefs.get(row.staffId.toString()) ?? null,
      type: row.type,
      amountPaise: row.amountPaise,
      mode: row.mode,
      paidOn: dayKey(row.paidOn, timeZone),
      note: row.note,
      voided: row.voidedAt !== null,
      voidReason: row.voidReason,
      recordedByName: row.recordedByName,
    })),
  };
}

/** Every payment matching the filters, oldest first, for the CSV download. */
export async function exportPaymentsCursor(
  viewer: SessionUser,
  filters: PaymentsFilters,
  q: string,
  timeZone: string,
  limit: number,
) {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const scope = await staffScope(orgId, filters, q);
  // A search that matches nobody exports nothing, rather than everything.
  const match = paymentsMatch(orgId, scope, filters, filters, timeZone);
  return StaffPayment.find(scope?.length === 0 ? { _id: null } : match)
    .sort({ paidOn: 1, _id: 1 })
    .limit(limit)
    .lean()
    .cursor();
}

/** The last 12 months for one person, oldest first, by type — the chart on their page. */
export async function staffPaidByMonth(
  viewer: SessionUser,
  staffId: string,
  timeZone: string,
  now = new Date(),
): Promise<PaymentBucket[]> {
  const today = todayKey(timeZone, now);
  const thisMonth = startOfMonthKey(today);
  const firstMonth = `${addMonths(thisMonth.slice(0, 7), -11)}-01`;
  const filters: PaymentsFilters = {
    preset: 'custom',
    from: firstMonth,
    to: today,
    staffId,
    role: null,
    type: null,
    mode: null,
  };
  const facts = await paymentFacts(viewer, filters, '', { from: firstMonth, to: today }, timeZone);
  return bucketFacts(facts, firstMonth, today, 'month');
}

function addMonths(month: string, by: number): string {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, (number ?? 1) - 1 + by, 1)).toISOString().slice(0, 7);
}
