import 'server-only';
import { Types, type ObjectId, type QueryFilter } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { addDays, dayKey, startOfDay, startOfMonthKey, todayKey } from '@/lib/dates';
import { dateToIso, idToString } from '@/lib/dto';
import type { SessionUser } from '@/lib/permissions';
import { keysetPage, type Page, type TableParams } from '@/lib/table';
import { escapeRegex } from '@/lib/utils';
import { Attendance } from '@/models/attendance';
import { StaffMember, type StaffMemberDoc } from '@/models/staff-member';
import { StaffPayment, type StaffPaymentDoc } from '@/models/staff-payment';
import { User } from '@/models/user';
import {
  STAFF_PAYMENT_TYPES,
  STAFF_ROLES,
  type StaffPaymentType,
  type StaffRole,
} from '@/models/constants';
import { monthOf } from './period';
import type {
  DayMark,
  PayrollRow,
  SheetRow,
  StaffGroup,
  StaffListRow,
  StaffPaymentRow,
  StaffPeriodSummary,
  StaffRow,
  StaffSort,
} from './types';
import {
  addCounts,
  balanceDue,
  daysInMonth,
  EMPTY_COUNTS,
  EMPTY_PAYMENTS,
  monthEarnings,
  type AttendanceCounts,
  type PaymentTotals,
  type WageTerms,
} from './wages';

const MAX_TIME_MS = 5_000;
/** Plenty for one plant's workforce; aggregate views beyond this belong in a report. */
const MAX_STAFF = 2_000;

export function toStaffRow(doc: StaffMemberDoc, timeZone: string): StaffRow {
  return {
    id: idToString(doc._id),
    name: doc.name,
    nameHi: doc.nameHi,
    role: doc.role,
    title: doc.title,
    phone: doc.phone,
    wageType: doc.wageType,
    wageRatePaise: doc.wageRatePaise,
    overtimeRatePaise: doc.overtimeRatePaise,
    joinedOn: doc.joinedOn ? dayKey(doc.joinedOn, timeZone) : null,
    leftOn: doc.leftOn ? dayKey(doc.leftOn, timeZone) : null,
    isActive: doc.isActive,
    userId: doc.userId ? idToString(doc.userId) : null,
    photoAssetId: doc.photoAssetId ? idToString(doc.photoAssetId) : null,
    gender: doc.gender,
    avatarVariant: doc.avatarVariant,
    address: doc.address,
    notes: doc.notes,
    createdAt: dateToIso(doc.createdAt),
  };
}

type Range = { from: string; to: string };

function dateMatch(range: Range | null, timeZone: string) {
  if (!range) return {};
  return {
    $gte: startOfDay(range.from, timeZone),
    $lt: startOfDay(addDays(range.to, 1), timeZone),
  };
}

/** Attendance counts per person per calendar month — the unit wages are worked out in. */
async function attendanceByMonth(
  orgId: ObjectId,
  staffIds: ObjectId[] | null,
  range: Range | null,
  timeZone: string,
): Promise<Map<string, Map<string, AttendanceCounts>>> {
  const flag = (status: string) => ({ $sum: { $cond: [{ $eq: ['$status', status] }, 1, 0] } });
  const rows = await Attendance.aggregate<{
    _id: { staffId: ObjectId; month: string };
    present: number;
    half_day: number;
    absent: number;
    leave: number;
    holiday: number;
    overtimeMinutes: number;
    bricks: number;
  }>([
    {
      $match: {
        orgId,
        ...(staffIds ? { staffId: { $in: staffIds } } : {}),
        ...(range ? { date: dateMatch(range, timeZone) } : {}),
      },
    },
    {
      $group: {
        _id: {
          staffId: '$staffId',
          month: { $dateToString: { date: '$date', format: '%Y-%m', timezone: timeZone } },
        },
        present: flag('present'),
        half_day: flag('half_day'),
        absent: flag('absent'),
        leave: flag('leave'),
        holiday: flag('holiday'),
        overtimeMinutes: { $sum: '$overtimeMinutes' },
        bricks: { $sum: '$bricks' },
      },
    },
  ]).option({ maxTimeMS: MAX_TIME_MS });

  const byStaff = new Map<string, Map<string, AttendanceCounts>>();
  for (const { _id, ...counts } of rows) {
    const key = _id.staffId.toString();
    const months = byStaff.get(key) ?? new Map<string, AttendanceCounts>();
    months.set(_id.month, counts);
    byStaff.set(key, months);
  }
  return byStaff;
}

/** Totals of live (not voided) payments per person and type. */
async function paymentTotals(
  orgId: ObjectId,
  staffIds: ObjectId[] | null,
  range: Range | null,
  timeZone: string,
): Promise<Map<string, PaymentTotals>> {
  const rows = await StaffPayment.aggregate<{
    _id: { staffId: ObjectId; type: StaffPaymentType };
    amountPaise: number;
  }>([
    {
      $match: {
        orgId,
        voidedAt: null,
        ...(staffIds ? { staffId: { $in: staffIds } } : {}),
        ...(range ? { paidOn: dateMatch(range, timeZone) } : {}),
      },
    },
    {
      $group: {
        _id: { staffId: '$staffId', type: '$type' },
        amountPaise: { $sum: '$amountPaise' },
      },
    },
  ]).option({ maxTimeMS: MAX_TIME_MS });

  const byStaff = new Map<string, PaymentTotals>();
  for (const row of rows) {
    const key = row._id.staffId.toString();
    const totals = byStaff.get(key) ?? { ...EMPTY_PAYMENTS };
    totals[row._id.type] += row.amountPaise;
    byStaff.set(key, totals);
  }
  return byStaff;
}

function summarise(
  terms: WageTerms,
  months: Map<string, AttendanceCounts> | undefined,
  payments: PaymentTotals | undefined,
): StaffPeriodSummary {
  let counts = { ...EMPTY_COUNTS };
  let earned = 0;
  for (const [month, monthCounts] of months ?? []) {
    counts = addCounts(counts, monthCounts);
    earned += monthEarnings(terms, monthCounts, daysInMonth(month));
  }
  const totals = payments ?? { ...EMPTY_PAYMENTS };
  return {
    counts,
    earnedPaise: earned,
    payments: totals,
    balancePaise: balanceDue(earned, totals),
  };
}

/** Summaries for many people at once: two aggregations, never one query per person. */
async function summariesFor(
  orgId: ObjectId,
  staff: Pick<StaffMemberDoc, '_id' | 'wageType' | 'wageRatePaise' | 'overtimeRatePaise'>[],
  range: Range | null,
  timeZone: string,
): Promise<Map<string, StaffPeriodSummary>> {
  const ids = staff.map((member) => member._id);
  const [attendance, payments] = await Promise.all([
    attendanceByMonth(orgId, ids, range, timeZone),
    paymentTotals(orgId, ids, range, timeZone),
  ]);
  return new Map(
    staff.map((member) => {
      const key = member._id.toString();
      return [key, summarise(member, attendance.get(key), payments.get(key))];
    }),
  );
}

export type StaffFilters = { status: 'active' | 'left' | 'all'; role: StaffRole | null };

type SearchParams = Record<string, string | string[] | undefined>;

export function parseStaffFilters(query: SearchParams): StaffFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const status = first(query.status);
  const role = first(query.role);
  return {
    status: status === 'left' ? 'left' : status === 'everyone' ? 'all' : 'active',
    role: STAFF_ROLES.find((candidate) => candidate === role) ?? null,
  };
}

function staffFilter(
  viewer: SessionUser,
  filters: StaffFilters,
  q: string,
): QueryFilter<StaffMemberDoc> {
  const filter: QueryFilter<StaffMemberDoc> = { orgId: new Types.ObjectId(viewer.orgId) };
  if (filters.status === 'active') filter.isActive = true;
  if (filters.status === 'left') filter.isActive = false;
  if (filters.role) filter.role = filters.role;
  const words = q.normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  if (words.length > 0) {
    filter.$and = words.map((word) => ({ searchTerms: { $regex: `^${escapeRegex(word)}` } }));
  }
  return filter;
}

export async function listStaff(
  viewer: SessionUser,
  params: TableParams<StaffSort> & StaffFilters,
  timeZone: string,
): Promise<Page<StaffListRow>> {
  await connectDb();
  const page = await keysetPage(StaffMember, staffFilter(viewer, params, params.q), params);
  const orgId = new Types.ObjectId(viewer.orgId);
  const ids = page.rows.map((row) => row._id);

  const [summaries, today] = await Promise.all([
    summariesFor(orgId, page.rows, null, timeZone),
    Attendance.find({
      orgId,
      staffId: { $in: ids },
      date: startOfDay(todayKey(timeZone), timeZone),
    })
      .select('staffId status')
      .lean(),
  ]);
  const todayByStaff = new Map(today.map((row) => [row.staffId.toString(), row.status]));

  return {
    ...page,
    rows: page.rows.map((doc) => ({
      ...toStaffRow(doc, timeZone),
      todayStatus: todayByStaff.get(doc._id.toString()) ?? null,
      balancePaise: summaries.get(doc._id.toString())?.balancePaise ?? 0,
    })),
  };
}

export type StaffGroupRow = {
  key: string;
  people: number;
  presentToday: number;
  balancePaise: number;
  advancesPaise: number;
};

/** "Group by" for the list: people per role or wage type, with what is owed to them. */
export async function groupStaff(
  viewer: SessionUser,
  filters: StaffFilters,
  q: string,
  group: StaffGroup,
  timeZone: string,
): Promise<StaffGroupRow[]> {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const staff = await StaffMember.find(staffFilter(viewer, filters, q))
    .select('role wageType wageRatePaise overtimeRatePaise')
    .limit(MAX_STAFF)
    .lean();

  const [summaries, today] = await Promise.all([
    summariesFor(orgId, staff, null, timeZone),
    Attendance.find({
      orgId,
      staffId: { $in: staff.map((member) => member._id) },
      date: startOfDay(todayKey(timeZone), timeZone),
      status: { $in: ['present', 'half_day'] },
    })
      .select('staffId')
      .lean(),
  ]);
  const presentToday = new Set(today.map((row) => row.staffId.toString()));

  const groups = new Map<string, StaffGroupRow>();
  for (const member of staff) {
    const key = group === 'role' ? member.role : member.wageType;
    const row = groups.get(key) ?? {
      key,
      people: 0,
      presentToday: 0,
      balancePaise: 0,
      advancesPaise: 0,
    };
    const summary = summaries.get(member._id.toString());
    row.people += 1;
    if (presentToday.has(member._id.toString())) row.presentToday += 1;
    row.balancePaise += Math.max(0, summary?.balancePaise ?? 0);
    row.advancesPaise += summary?.payments.advance ?? 0;
    groups.set(key, row);
  }
  return [...groups.values()];
}

export async function staffStats(viewer: SessionUser, timeZone: string) {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const today = todayKey(timeZone);
  const active = await StaffMember.find({ orgId, isActive: true })
    .select('wageType wageRatePaise overtimeRatePaise')
    .limit(MAX_STAFF)
    .lean();

  const [summaries, presentToday, monthPayments] = await Promise.all([
    summariesFor(orgId, active, null, timeZone),
    Attendance.countDocuments({
      orgId,
      date: startOfDay(today, timeZone),
      status: { $in: ['present', 'half_day'] },
    }),
    paymentTotals(orgId, null, { from: startOfMonthKey(today), to: today }, timeZone),
  ]);

  let wagesDue = 0;
  for (const summary of summaries.values()) wagesDue += Math.max(0, summary.balancePaise);
  let advancesThisMonth = 0;
  for (const totals of monthPayments.values()) advancesThisMonth += totals.advance;

  return {
    active: active.length,
    presentToday,
    wagesDuePaise: wagesDue,
    advancesThisMonthPaise: advancesThisMonth,
  };
}

/**
 * The daily sheet: everyone currently working, plus anyone who has since
 * left but was marked on that day (so an old sheet still shows them).
 */
export async function attendanceSheet(
  viewer: SessionUser,
  day: string,
  timeZone: string,
): Promise<SheetRow[]> {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const date = startOfDay(day, timeZone);
  const records = await Attendance.find({ orgId, date }).lean();
  const markedIds = records.map((record) => record.staffId);

  const staff = await StaffMember.find({
    orgId,
    $or: [{ isActive: true }, { _id: { $in: markedIds } }],
  })
    .sort({ name: 1, _id: 1 })
    .limit(MAX_STAFF)
    .lean();
  const byStaff = new Map(records.map((record) => [record.staffId.toString(), record]));

  return staff.map((member) => {
    const record = byStaff.get(member._id.toString());
    return {
      id: idToString(member._id),
      name: member.name,
      nameHi: member.nameHi,
      role: member.role,
      wageType: member.wageType,
      photoAssetId: member.photoAssetId ? idToString(member.photoAssetId) : null,
      gender: member.gender,
      avatarVariant: member.avatarVariant,
      isActive: member.isActive,
      status: record?.status ?? null,
      overtimeMinutes: record?.overtimeMinutes ?? 0,
      bricks: record?.bricks ?? 0,
    };
  });
}

export async function getStaff(
  viewer: SessionUser,
  id: string,
  timeZone: string,
): Promise<StaffRow | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDb();
  const doc = await StaffMember.findOne({ _id: id, orgId: viewer.orgId }).lean();
  return doc ? toStaffRow(doc, timeZone) : null;
}

/** A month at a glance: every marked day, the month's figures, and what is owed overall. */
export async function staffMonth(
  viewer: SessionUser,
  staff: StaffRow,
  month: string,
  timeZone: string,
) {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const staffId = new Types.ObjectId(staff.id);
  const range = {
    from: `${month}-01`,
    to: `${month}-${String(daysInMonth(month)).padStart(2, '0')}`,
  };
  const terms = { ...staff, _id: staffId };

  const [records, monthSummary, overall] = await Promise.all([
    Attendance.find({ orgId, staffId, date: dateMatch(range, timeZone) })
      .sort({ date: 1 })
      .lean(),
    summariesFor(orgId, [terms], range, timeZone),
    summariesFor(orgId, [terms], null, timeZone),
  ]);

  const marks: DayMark[] = records.map((record) => ({
    day: dayKey(record.date, timeZone),
    status: record.status,
    overtimeMinutes: record.overtimeMinutes,
    bricks: record.bricks,
  }));
  return {
    marks,
    summary: monthSummary.get(staff.id) ?? summarise(staff, undefined, undefined),
    balancePaise: overall.get(staff.id)?.balancePaise ?? 0,
  };
}

export const STAFF_PAYMENT_SORTS = ['paidOn', 'amountPaise'] as const;

export async function listStaffPayments(
  viewer: SessionUser,
  staffId: string,
  params: TableParams<(typeof STAFF_PAYMENT_SORTS)[number]> & { type: StaffPaymentType | null },
  timeZone: string,
): Promise<Page<StaffPaymentRow>> {
  await connectDb();
  const filter: QueryFilter<StaffPaymentDoc> = {
    orgId: new Types.ObjectId(viewer.orgId),
    staffId: new Types.ObjectId(staffId),
    ...(params.type ? { type: params.type } : {}),
  };
  const page = await keysetPage(StaffPayment, filter, params);
  return {
    ...page,
    rows: page.rows.map((row) => ({
      id: idToString(row._id),
      type: row.type,
      amountPaise: row.amountPaise,
      mode: row.mode,
      paidOn: dayKey(row.paidOn, timeZone),
      periodFrom: row.periodFrom ? dayKey(row.periodFrom, timeZone) : null,
      periodTo: row.periodTo ? dayKey(row.periodTo, timeZone) : null,
      note: row.note,
      voided: row.voidedAt !== null,
      voidReason: row.voidReason,
      recordedByName: row.recordedByName,
    })),
  };
}

export function parsePaymentType(value: string | string[] | undefined): StaffPaymentType | null {
  const single = Array.isArray(value) ? value[0] : value;
  return STAFF_PAYMENT_TYPES.find((candidate) => candidate === single) ?? null;
}

/**
 * Pay for a period: everyone working now, plus anyone who worked or was paid
 * in the period and has since left. Earnings are worked out month by month so
 * a monthly salary is shared over the right number of days.
 */
export async function payroll(
  viewer: SessionUser,
  range: Range,
  timeZone: string,
): Promise<PayrollRow[]> {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const [attendance, payments] = await Promise.all([
    attendanceByMonth(orgId, null, range, timeZone),
    paymentTotals(orgId, null, range, timeZone),
  ]);
  const involved = [...new Set([...attendance.keys(), ...payments.keys()])].map(
    (id) => new Types.ObjectId(id),
  );

  const staff = await StaffMember.find({
    orgId,
    $or: [{ isActive: true }, { _id: { $in: involved } }],
  })
    .sort({ name: 1, _id: 1 })
    .limit(MAX_STAFF)
    .lean();

  return staff.map((member) => {
    const key = member._id.toString();
    return {
      id: key,
      name: member.name,
      nameHi: member.nameHi,
      role: member.role,
      wageType: member.wageType,
      wageRatePaise: member.wageRatePaise,
      isActive: member.isActive,
      ...summarise(member, attendance.get(key), payments.get(key)),
    };
  });
}

/** App logins that can be linked to this person: not yet linked to anyone else. */
export async function linkableLogins(viewer: SessionUser, currentStaffId: string | null) {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const linked = await StaffMember.find({
    orgId,
    userId: { $ne: null },
    ...(currentStaffId ? { _id: { $ne: new Types.ObjectId(currentStaffId) } } : {}),
  })
    .select('userId')
    .lean();
  const taken = linked.map((row) => row.userId).filter((id): id is ObjectId => id !== null);
  const users = await User.find({ orgId, disabledAt: null, _id: { $nin: taken } })
    .select('name phone')
    .sort({ name: 1 })
    .limit(500)
    .lean();
  return users.map((user) => ({ id: idToString(user._id), name: user.name, phone: user.phone }));
}

/** One person's figures for any stretch of days (the salary slip). */
export async function staffPeriod(
  viewer: SessionUser,
  staff: StaffRow,
  range: Range,
  timeZone: string,
): Promise<StaffPeriodSummary> {
  await connectDb();
  const staffId = new Types.ObjectId(staff.id);
  const summaries = await summariesFor(
    new Types.ObjectId(viewer.orgId),
    [{ ...staff, _id: staffId }],
    range,
    timeZone,
  );
  return summaries.get(staff.id) ?? summarise(staff, undefined, undefined);
}

/** The name on a linked app login, for the staff page. */
export async function loginName(viewer: SessionUser, userId: string): Promise<string | null> {
  if (!Types.ObjectId.isValid(userId)) return null;
  await connectDb();
  const user = await User.findOne({ _id: userId, orgId: viewer.orgId }).select('name').lean();
  return user?.name ?? null;
}

export { monthOf };
