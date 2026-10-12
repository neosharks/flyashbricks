import 'server-only';
import { pickText } from '@/lib/bilingual';
import { requestLocale } from '@/lib/locale';
import { Types, type ObjectId, type QueryFilter } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { dateToIso, idToString, optionalIdToString } from '@/lib/dto';
import { addDays, dayRange, startOfDay, startOfMonthKey, todayKey } from '@/lib/dates';
import type { SessionUser } from '@/lib/permissions';
import { keysetPage, type Page, type TableParams } from '@/lib/table';
import { RawMaterial, type RawMaterialDoc } from '@/models/raw-material';
import { MaterialMovement, type MaterialMovementDoc } from '@/models/material-movement';
import { User } from '@/models/user';
import type { MaterialMovementType } from '@/models/constants';
import type { DayRange } from '@/features/production/range';
import { averageDailyUse, fillRatio, RUNWAY_WINDOW_DAYS, runwayDays, stockLevel } from './forecast';
import { prefixRegex, timeBucketExpression } from '@/features/production/grouping';
import type { MaterialMovementRow, MaterialOption, MaterialRow } from './types';

const CONSUMPTION_TYPES: MaterialMovementType[] = ['consumption', 'consumption_reversal'];

/** Net consumption per material over the forecast window, keyed by material id. */
async function netConsumption(orgId: ObjectId, timezone: string): Promise<Map<string, number>> {
  const since = startOfDay(addDays(todayKey(timezone), -(RUNWAY_WINDOW_DAYS - 1)), timezone);
  const rows = await MaterialMovement.aggregate<{ _id: ObjectId; net: number }>([
    { $match: { orgId, type: { $in: CONSUMPTION_TYPES }, occurredAt: { $gte: since } } },
    { $group: { _id: '$materialId', net: { $sum: '$qtyMilli' } } },
  ]).option({ maxTimeMS: 5_000 });
  return new Map(rows.map((row) => [row._id.toString(), row.net]));
}

function toMaterialRow(
  doc: RawMaterialDoc,
  net: number | undefined,
  locale: 'en' | 'hi',
): MaterialRow {
  const dailyUseMilli = averageDailyUse(net ?? 0);
  return {
    id: idToString(doc._id),
    name: pickText(doc.name, doc.nameHi, locale),
    nameEn: doc.name,
    nameHi: doc.nameHi ?? null,
    kind: doc.kind,
    unit: doc.unit,
    quantityMilli: doc.quantityMilli,
    lowThresholdMilli: doc.lowThresholdMilli,
    capacityMilli: doc.capacityMilli,
    lastRatePaise: doc.lastRatePaise,
    isActive: doc.isActive,
    level: stockLevel(doc.quantityMilli, doc.lowThresholdMilli),
    fill: fillRatio(doc.quantityMilli, doc.lowThresholdMilli, doc.capacityMilli),
    dailyUseMilli,
    runwayDays: runwayDays(doc.quantityMilli, dailyUseMilli),
  };
}

export async function listMaterials(viewer: SessionUser, timezone: string): Promise<MaterialRow[]> {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const [docs, net, locale] = await Promise.all([
    RawMaterial.find({ orgId }).sort({ isActive: -1, name: 1 }).limit(200).lean(),
    netConsumption(orgId, timezone),
    requestLocale(),
  ]);
  return docs.map((doc) => toMaterialRow(doc, net.get(doc._id.toString()), locale));
}

export async function getMaterial(
  viewer: SessionUser,
  id: string,
  timezone: string,
): Promise<MaterialRow | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const [doc, net, locale] = await Promise.all([
    RawMaterial.findOne({ _id: id, orgId }).lean(),
    netConsumption(orgId, timezone),
    requestLocale(),
  ]);
  return doc ? toMaterialRow(doc, net.get(doc._id.toString()), locale) : null;
}

/** Active materials for pickers (recipe editor, production preview). */
export async function materialOptions(viewer: SessionUser): Promise<MaterialOption[]> {
  await connectDb();
  const [docs, locale] = await Promise.all([
    RawMaterial.find({ orgId: viewer.orgId, isActive: true })
      .select('name nameHi unit quantityMilli')
      .sort({ name: 1 })
      .limit(200)
      .lean(),
    requestLocale(),
  ]);
  return docs.map((doc) => ({
    id: idToString(doc._id),
    name: pickText(doc.name, doc.nameHi, locale),
    unit: doc.unit,
    quantityMilli: doc.quantityMilli,
  }));
}

export async function purchaseSpendThisMonth(viewer: SessionUser, timezone: string) {
  await connectDb();
  const since = startOfDay(startOfMonthKey(todayKey(timezone)), timezone);
  const [row] = await MaterialMovement.aggregate<{ spend: number; count: number }>([
    {
      $match: {
        orgId: new Types.ObjectId(viewer.orgId),
        type: 'purchase',
        occurredAt: { $gte: since },
      },
    },
    { $group: { _id: null, spend: { $sum: { $ifNull: ['$costPaise', 0] } }, count: { $sum: 1 } } },
  ]).option({ maxTimeMS: 5_000 });
  return { spendPaise: row?.spend ?? 0, purchases: row?.count ?? 0 };
}

/**
 * `costPaise` is only set on purchases, and keyset paging cannot step over
 * nulls, so ordering by cost is offered only with the purchases filter on.
 */
export const MOVEMENT_SORTS = ['occurredAt', 'qtyMilli', 'costPaise'] as const;
export type MovementSort = (typeof MOVEMENT_SORTS)[number];

export type MovementFilters = { type: MaterialMovementType | null; range: DayRange; q: string };

function movementFilter(
  viewer: SessionUser,
  materialId: string,
  filters: MovementFilters,
  timezone: string,
): QueryFilter<MaterialMovementDoc> {
  const filter: QueryFilter<MaterialMovementDoc> = {
    orgId: new Types.ObjectId(viewer.orgId),
    materialId: new Types.ObjectId(materialId),
  };
  if (filters.type) filter.type = filters.type;
  if (filters.range.from || filters.range.to) {
    filter.occurredAt = {
      ...(filters.range.from ? { $gte: startOfDay(filters.range.from, timezone) } : {}),
      ...(filters.range.to ? { $lt: startOfDay(addDays(filters.range.to, 1), timezone) } : {}),
    };
  }
  if (filters.q) {
    const match = prefixRegex(filters.q);
    filter.$or = [{ supplier: match }, { note: match }];
  }
  return filter;
}

export async function listMaterialMovements(
  viewer: SessionUser,
  materialId: string,
  params: TableParams<MovementSort> & MovementFilters,
  timezone: string,
): Promise<Page<MaterialMovementRow>> {
  await connectDb();
  const sort =
    params.sort === 'costPaise' && params.type !== 'purchase' ? 'occurredAt' : params.sort;
  const filter = movementFilter(viewer, materialId, params, timezone);

  const page = await keysetPage(MaterialMovement, filter, { ...params, sort });
  const names = await userNames(page.rows.map((row) => row.createdBy));

  return {
    ...page,
    rows: page.rows.map((row) => ({
      id: idToString(row._id),
      type: row.type,
      qtyMilli: row.qtyMilli,
      balanceAfterMilli: row.balanceAfterMilli,
      costPaise: row.costPaise,
      supplier: row.supplier,
      note: row.note,
      productionId: optionalIdToString(row.productionId),
      occurredAt: dateToIso(row.occurredAt),
      createdByName: names.get(row.createdBy.toString()) ?? null,
    })),
  };
}

/** Names for a page's worth of user ids: one query, bounded by the page size. */
export async function userNames(ids: ObjectId[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.map((id) => id.toString()))];
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: { $in: unique } })
    .select('name')
    .lean();
  return new Map(users.map((user) => [user._id.toString(), user.name]));
}

/** Material used per day over the last `days` days, oldest first, zero-filled. */
export async function dailyConsumption(
  viewer: SessionUser,
  materialId: string,
  timezone: string,
  days = 30,
): Promise<{ day: string; usedMilli: number; purchasedMilli: number }[]> {
  await connectDb();
  const today = todayKey(timezone);
  const firstDay = addDays(today, -(days - 1));
  const rows = await MaterialMovement.aggregate<{ _id: string; used: number; purchased: number }>([
    {
      $match: {
        orgId: new Types.ObjectId(viewer.orgId),
        materialId: new Types.ObjectId(materialId),
        occurredAt: { $gte: startOfDay(firstDay, timezone) },
      },
    },
    {
      $group: {
        _id: { $dateToString: { date: '$occurredAt', format: '%Y-%m-%d', timezone } },
        used: {
          $sum: {
            $cond: [{ $in: ['$type', CONSUMPTION_TYPES] }, { $multiply: ['$qtyMilli', -1] }, 0],
          },
        },
        purchased: { $sum: { $cond: [{ $eq: ['$type', 'purchase'] }, '$qtyMilli', 0] } },
      },
    },
  ]).option({ maxTimeMS: 5_000 });

  const byDay = new Map(rows.map((row) => [row._id, row]));
  return dayRange(firstDay, today).map((day) => ({
    day,
    usedMilli: Math.max(0, byDay.get(day)?.used ?? 0),
    purchasedMilli: byDay.get(day)?.purchased ?? 0,
  }));
}

export const MOVEMENT_GROUPS = ['month', 'supplier'] as const;
export type MovementGroup = (typeof MOVEMENT_GROUPS)[number];

export type MovementGroupRow = {
  /** Month's first day key, or the supplier's name. */
  key: string;
  purchases: number;
  purchasedMilli: number;
  spendPaise: number;
  usedMilli: number;
  adjustedMilli: number;
};

/**
 * Per month: what came in, what it cost, what was used and corrected.
 * Per supplier: purchases only — how much was bought from whom, and at what
 * average price per unit.
 */
export async function groupMaterialMovements(
  viewer: SessionUser,
  materialId: string,
  group: MovementGroup,
  filters: MovementFilters,
  timezone: string,
): Promise<MovementGroupRow[]> {
  await connectDb();
  const match = movementFilter(viewer, materialId, filters, timezone);
  if (group === 'supplier') match.type = 'purchase';

  const rows = await MaterialMovement.aggregate<{
    _id: string | null;
    purchases: number;
    purchasedMilli: number;
    spendPaise: number;
    usedMilli: number;
    adjustedMilli: number;
  }>([
    { $match: match },
    {
      $group: {
        _id:
          group === 'month'
            ? timeBucketExpression('occurredAt', 'month', timezone)
            : { $ifNull: ['$supplier', ''] },
        purchases: { $sum: { $cond: [{ $eq: ['$type', 'purchase'] }, 1, 0] } },
        purchasedMilli: { $sum: { $cond: [{ $eq: ['$type', 'purchase'] }, '$qtyMilli', 0] } },
        spendPaise: { $sum: { $ifNull: ['$costPaise', 0] } },
        usedMilli: {
          $sum: {
            $cond: [{ $in: ['$type', CONSUMPTION_TYPES] }, { $multiply: ['$qtyMilli', -1] }, 0],
          },
        },
        adjustedMilli: { $sum: { $cond: [{ $eq: ['$type', 'adjustment'] }, '$qtyMilli', 0] } },
      },
    },
    { $sort: group === 'month' ? { _id: -1 } : { spendPaise: -1 } },
    { $limit: 400 },
  ]).option({ maxTimeMS: 5_000 });

  return rows.map((row) => ({
    key: row._id ?? '',
    purchases: row.purchases,
    purchasedMilli: row.purchasedMilli,
    spendPaise: row.spendPaise,
    usedMilli: row.usedMilli,
    adjustedMilli: row.adjustedMilli,
  }));
}

/** Paise per whole unit across a supplier's purchases; null when nothing was bought. */
export function averageRatePaise(spendPaise: number, purchasedMilli: number): number | null {
  return purchasedMilli > 0 ? Math.round((spendPaise * 1000) / purchasedMilli) : null;
}
