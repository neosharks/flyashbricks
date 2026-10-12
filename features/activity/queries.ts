import 'server-only';
import type { Gender } from '@/models/constants';
import { Types, type ObjectId, type QueryFilter } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { addDays, DEFAULT_TIMEZONE, startOfDay } from '@/lib/dates';
import { dateToIso, idToString } from '@/lib/dto';
import type { SessionUser } from '@/lib/permissions';
import { keysetPage, type Page, type TableParams } from '@/lib/table';
import { AuditLog, type AuditLogDoc } from '@/models/audit-log';
import { User } from '@/models/user';
import { toActivityRow } from '@/features/users/queries';
import type { ActivityRow } from '@/features/users/types';
import type { DayRange } from '@/features/production/range';
import { prefixRegex, timeBucketExpression } from '@/features/production/grouping';
import type { ActivityEntity } from './links';

export const ACTIVITY_SORTS = ['createdAt'] as const;

/** `userId` and `range` are optional so callers like the dashboard's "latest activity" stay simple. */
export type ActivityFilters = {
  entity: ActivityEntity | null;
  userId?: string | null;
  range?: DayRange;
  q: string;
};

function activityFilter(
  viewer: SessionUser,
  filters: ActivityFilters,
  timezone: string,
): QueryFilter<AuditLogDoc> {
  const filter: QueryFilter<AuditLogDoc> = { orgId: new Types.ObjectId(viewer.orgId) };
  if (filters.entity) filter.entity = filters.entity;
  if (filters.userId && Types.ObjectId.isValid(filters.userId)) {
    filter.actorUserId = new Types.ObjectId(filters.userId);
  }
  const range = filters.range;
  if (range && (range.from || range.to)) {
    filter.createdAt = {
      ...(range.from ? { $gte: startOfDay(range.from, timezone) } : {}),
      ...(range.to ? { $lt: startOfDay(addDays(range.to, 1), timezone) } : {}),
    };
  }
  if (filters.q) filter.actorName = prefixRegex(filters.q);
  return filter;
}

export async function listActivity(
  viewer: SessionUser,
  params: TableParams<'createdAt'> & ActivityFilters,
  timezone: string = DEFAULT_TIMEZONE,
): Promise<Page<ActivityRow>> {
  await connectDb();
  const page = await keysetPage(AuditLog, activityFilter(viewer, params, timezone), params);
  return { ...page, rows: page.rows.map(toActivityRow) };
}

/** Photos for the people on one page of the log: a single query, never one per row. */
/** What `<Avatar>` needs for a person: their photo, or the cartoon they were given. */
export type ActorAvatar = { imageId: string | null; gender: Gender; variant: number };

export async function actorAvatars(
  viewer: SessionUser,
  userIds: (string | null)[],
): Promise<Map<string, ActorAvatar>> {
  const ids = [
    ...new Set(userIds.filter((id): id is string => id !== null && Types.ObjectId.isValid(id))),
  ];
  if (ids.length === 0) return new Map();
  await connectDb();
  const users = await User.find({ orgId: viewer.orgId, _id: { $in: ids } })
    .select('avatarAssetId gender avatarVariant')
    .lean();
  return new Map(
    users.map((user) => [
      user._id.toString(),
      {
        imageId: user.avatarAssetId ? idToString(user.avatarAssetId) : null,
        gender: user.gender,
        variant: user.avatarVariant,
      },
    ]),
  );
}

/** The name behind `?user=`, for the filter chip; null when it is not someone in this organisation. */
export async function activityPersonName(viewer: SessionUser, userId: string | null) {
  if (!userId || !Types.ObjectId.isValid(userId)) return null;
  await connectDb();
  const user = await User.findOne({ _id: userId, orgId: viewer.orgId }).select('name').lean();
  return user?.name ?? null;
}

export const ACTIVITY_GROUPS = ['person', 'area', 'day'] as const;
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number];

export type ActivityGroupRow = {
  /** User id, entity name, or day key. */
  key: string;
  /** The person's name for `person`; otherwise equal to `key`. */
  label: string;
  changes: number;
  lastAt: string;
};

/** How many changes per person, area of the app or day, for the same filters as the log. */
export async function groupActivity(
  viewer: SessionUser,
  group: ActivityGroup,
  filters: ActivityFilters,
  timezone: string,
): Promise<ActivityGroupRow[]> {
  await connectDb();
  const rows = await AuditLog.aggregate<{
    _id: string | ObjectId | null;
    name: string | null;
    changes: number;
    lastAt: Date;
  }>([
    { $match: activityFilter(viewer, filters, timezone) },
    {
      $group: {
        _id:
          group === 'person'
            ? '$actorUserId'
            : group === 'area'
              ? '$entity'
              : timeBucketExpression('createdAt', 'day', timezone),
        name: { $last: '$actorName' },
        changes: { $sum: 1 },
        lastAt: { $max: '$createdAt' },
      },
    },
    { $sort: group === 'day' ? { _id: -1 } : { changes: -1 } },
    { $limit: 400 },
  ]).option({ maxTimeMS: 5_000 });

  return rows.map((row) => {
    const key = row._id === null ? '' : row._id.toString();
    return {
      key,
      label: group === 'person' ? (row.name ?? '') : key,
      changes: row.changes,
      lastAt: dateToIso(row.lastAt),
    };
  });
}
