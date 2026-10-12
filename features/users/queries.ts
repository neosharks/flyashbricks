import 'server-only';
import { pickText } from '@/lib/bilingual';
import { requestLocale } from '@/lib/locale';
import { Types, type QueryFilter } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { dateToIso, idToString } from '@/lib/dto';
import { NO_ACCESS, type Role, type SessionUser } from '@/lib/permissions';
import { keysetPage, type Page, type TableParams } from '@/lib/table';
import { escapeRegex } from '@/lib/utils';
import { normalizePhone } from '@/lib/phone';
import { User, type UserDoc } from '@/models/user';
import { LoginEvent, type LoginEventDoc } from '@/models/login-event';
import { AuditLog, type AuditLogDoc } from '@/models/audit-log';
import type { ActivityRow, LoginEventRow, UserRow } from './types';

export const USER_SORTS = ['name', 'lastLoginAt', 'createdAt'] as const;
export type UserSort = (typeof USER_SORTS)[number];

export function toUserRow(doc: UserDoc, locale: 'en' | 'hi' = 'en'): UserRow {
  return {
    id: idToString(doc._id),
    name: pickText(doc.name, doc.nameHi, locale),
    nameEn: doc.name,
    nameHi: doc.nameHi ?? null,
    phone: doc.phone,
    email: doc.email,
    jobTitle: doc.jobTitle,
    role: doc.role,
    permissions: { ...NO_ACCESS, ...doc.permissions },
    mustChangePassword: doc.mustChangePassword,
    disabled: doc.disabledAt !== null,
    lastLoginAt: doc.lastLoginAt ? dateToIso(doc.lastLoginAt) : null,
    avatarAssetId: doc.avatarAssetId ? idToString(doc.avatarAssetId) : null,
    gender: doc.gender,
    avatarVariant: doc.avatarVariant,
    createdAt: dateToIso(doc.createdAt),
  };
}

export function toActivityRow(doc: AuditLogDoc): ActivityRow {
  return {
    id: idToString(doc._id),
    actorUserId: doc.actorUserId ? idToString(doc.actorUserId) : null,
    actorName: doc.actorName,
    action: doc.action,
    entity: doc.entity,
    entityId: doc.entityId,
    changes: doc.changes,
    createdAt: dateToIso(doc.createdAt),
  };
}

export const USER_STATUSES = ['active', 'pending', 'disabled'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type UserFilters = { status: UserStatus | null; role: Role | null; q: string };

/** One filter for the list and its grouped view. */
function userFilter(viewer: SessionUser, filters: UserFilters): QueryFilter<UserDoc> {
  const filter: QueryFilter<UserDoc> = { orgId: new Types.ObjectId(viewer.orgId) };
  if (filters.role) filter.role = filters.role;
  if (filters.status === 'disabled') filter.disabledAt = { $ne: null };
  if (filters.status === 'active') filter.disabledAt = null;
  // "Not signed in yet": an active account that has never been used.
  if (filters.status === 'pending') {
    filter.disabledAt = null;
    filter.lastLoginAt = null;
  }

  if (filters.q) {
    const digits = normalizePhone(filters.q) ?? filters.q.replace(/\D/g, '');
    filter.$or = [
      // Anchored, so the regex starts at the front of the name; a team is small
      // and the org prefix of the index bounds the scan.
      { name: { $regex: `^${escapeRegex(filters.q)}`, $options: 'i' } },
      ...(digits.length >= 3 ? [{ phone: { $regex: `^${escapeRegex(digits)}` } }] : []),
    ];
  }
  return filter;
}

export async function listUsers(
  viewer: SessionUser,
  params: TableParams<UserSort> & UserFilters,
): Promise<Page<UserRow>> {
  await connectDb();
  const filter = userFilter(viewer, params);

  // `lastLoginAt` is null for someone who never signed in; keyset paging
  // cannot compare nulls, so that sort only covers people who have.
  if (params.sort === 'lastLoginAt') filter.lastLoginAt = { $ne: null };

  const page = await keysetPage(User, filter, params);
  const locale = await requestLocale();
  return { ...page, rows: page.rows.map((doc) => toUserRow(doc, locale)) };
}

export async function countUsers(viewer: SessionUser) {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const [active, disabled, neverSignedIn] = await Promise.all([
    User.countDocuments({ orgId, disabledAt: null }),
    User.countDocuments({ orgId, disabledAt: { $ne: null } }),
    User.countDocuments({ orgId, disabledAt: null, lastLoginAt: null }),
  ]);
  return { active, disabled, neverSignedIn };
}

export async function getUser(viewer: SessionUser, id: string): Promise<UserRow | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDb();
  const doc = await User.findOne({ _id: id, orgId: viewer.orgId }).lean();
  return doc ? toUserRow(doc, await requestLocale()) : null;
}

export const LOGIN_SORTS = ['createdAt'] as const;

/** One person's sign-in attempts, newest first by default, paged. */
export async function getLoginHistory(
  viewer: SessionUser,
  userId: string,
  params: TableParams<'createdAt'> & { result: 'success' | 'failed' | null },
): Promise<Page<LoginEventRow>> {
  if (!Types.ObjectId.isValid(userId)) return { rows: [], next: null, prev: null };
  await connectDb();
  const filter: QueryFilter<LoginEventDoc> = {
    orgId: new Types.ObjectId(viewer.orgId),
    userId: new Types.ObjectId(userId),
  };
  if (params.result) filter.success = params.result === 'success';

  const page = await keysetPage(LoginEvent, filter, params);
  return {
    ...page,
    rows: page.rows.map((row) => ({
      id: idToString(row._id),
      success: row.success,
      reason: row.reason,
      ip: row.ip,
      userAgent: row.userAgent,
      createdAt: dateToIso(row.createdAt),
    })),
  };
}

export async function getUserActivity(viewer: SessionUser, userId: string): Promise<ActivityRow[]> {
  await connectDb();
  const rows = await AuditLog.find({ orgId: viewer.orgId, actorUserId: userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  return rows.map(toActivityRow);
}

export const USER_GROUPS = ['role', 'status'] as const;
export type UserGroup = (typeof USER_GROUPS)[number];

export type UserGroupRow = {
  key: string;
  people: number;
  active: number;
  pending: number;
  disabled: number;
};

/** Headcount per role or per status, for the same search as the list. */
export async function groupUsers(
  viewer: SessionUser,
  group: UserGroup,
  filters: UserFilters,
): Promise<UserGroupRow[]> {
  await connectDb();
  const status = {
    $switch: {
      branches: [
        { case: { $ne: ['$disabledAt', null] }, then: 'disabled' },
        { case: { $eq: ['$lastLoginAt', null] }, then: 'pending' },
      ],
      default: 'active',
    },
  };
  const rows = await User.aggregate<{ _id: string; statuses: string[] }>([
    { $match: userFilter(viewer, filters) },
    { $group: { _id: group === 'role' ? '$role' : status, statuses: { $push: status } } },
    { $sort: { _id: 1 } },
  ]).option({ maxTimeMS: 5_000 });

  return rows.map((row) => ({
    key: row._id,
    people: row.statuses.length,
    active: row.statuses.filter((value) => value === 'active').length,
    pending: row.statuses.filter((value) => value === 'pending').length,
    disabled: row.statuses.filter((value) => value === 'disabled').length,
  }));
}
