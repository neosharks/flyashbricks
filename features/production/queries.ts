import 'server-only';
import { pickText } from '@/lib/bilingual';
import { requestLocale } from '@/lib/locale';
import { Types, type ObjectId, type QueryFilter } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { dateToIso, idToString } from '@/lib/dto';
import { addDays, dayKey, dayRange, startOfDay, startOfMonthKey, todayKey } from '@/lib/dates';
import type { SessionUser } from '@/lib/permissions';
import { keysetPage, type Page, type TableParams } from '@/lib/table';
import { ProductionEntry, type ProductionEntryDoc } from '@/models/production-entry';
import { RawMaterial } from '@/models/raw-material';
import { Product } from '@/models/product';
import type { DayRange } from './range';
import { bucketRange, prefixRegex, timeBucketExpression, type TimeUnit } from './grouping';
import type { ProductOption, ProductionDay, ProductionEntryRow, ProductionSummary } from './types';

export const PRODUCTION_SORTS = ['date', 'goodQty', 'defectiveQty', 'productName'] as const;
export type ProductionSort = (typeof PRODUCTION_SORTS)[number];

function rangeFilter(range: DayRange, timezone: string) {
  if (!range.from && !range.to) return {};
  return {
    date: {
      ...(range.from ? { $gte: startOfDay(range.from, timezone) } : {}),
      ...(range.to ? { $lt: startOfDay(addDays(range.to, 1), timezone) } : {}),
    },
  };
}

export type ProductionFilters = { productId: string | null; range: DayRange; q: string };

/**
 * One filter for the list and its grouped view, so a group's total always
 * matches the rows it opens. Search covers who entered it, the brick type and
 * the note — prefix matches inside the org + date range the index already bounds.
 */
function productionFilter(
  viewer: SessionUser,
  filters: ProductionFilters,
  timezone: string,
): QueryFilter<ProductionEntryDoc> {
  const filter: QueryFilter<ProductionEntryDoc> = {
    orgId: new Types.ObjectId(viewer.orgId),
    ...rangeFilter(filters.range, timezone),
  };
  if (filters.productId && Types.ObjectId.isValid(filters.productId)) {
    filter.productId = new Types.ObjectId(filters.productId);
  }
  if (filters.q) {
    const match = prefixRegex(filters.q);
    filter.$or = [
      { createdByName: match },
      { productName: match },
      { productNameHi: match },
      { note: match },
    ];
  }
  return filter;
}

export async function listProductionEntries(
  viewer: SessionUser,
  params: TableParams<ProductionSort> & ProductionFilters,
  timezone: string,
): Promise<Page<ProductionEntryRow>> {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const filter = productionFilter(viewer, params, timezone);

  const page = await keysetPage(ProductionEntry, filter, params);
  const materialIds = [
    ...new Set(
      page.rows.flatMap((row) => row.consumption.map((line) => line.materialId.toString())),
    ),
  ];
  const [materials, locale] = await Promise.all([
    RawMaterial.find({ orgId, _id: { $in: materialIds } })
      .select('name nameHi unit')
      .lean(),
    requestLocale(),
  ]);
  const byId = new Map(materials.map((material) => [material._id.toString(), material]));

  return {
    ...page,
    rows: page.rows.map((row) => ({
      id: idToString(row._id),
      productId: idToString(row.productId),
      productName: pickText(row.productName, row.productNameHi, locale),
      day: dayKey(row.date, timezone),
      goodQty: row.goodQty,
      defectiveQty: row.defectiveQty,
      note: row.note,
      consumption: row.consumption.map((line) => {
        const material = byId.get(line.materialId.toString());
        return {
          materialId: line.materialId.toString(),
          materialName: material ? pickText(material.name, material.nameHi, locale) : '—',
          unit: material?.unit ?? 'kg',
          qtyMilli: line.qtyMilli,
        };
      }),
      voided: row.voidedAt !== null,
      voidReason: row.voidReason,
      createdByName: row.createdByName,
      createdAt: dateToIso(row.createdAt),
    })),
  };
}

async function totals(orgId: ObjectId, match: Record<string, unknown>) {
  const [row] = await ProductionEntry.aggregate<{
    good: number;
    defective: number;
    entries: number;
  }>([
    { $match: { orgId, voidedAt: null, ...match } },
    {
      $group: {
        _id: null,
        good: { $sum: '$goodQty' },
        defective: { $sum: '$defectiveQty' },
        entries: { $sum: 1 },
      },
    },
  ]).option({ maxTimeMS: 5_000 });
  return { good: row?.good ?? 0, defective: row?.defective ?? 0, entries: row?.entries ?? 0 };
}

export async function productionSummary(
  viewer: SessionUser,
  timezone: string,
  range: DayRange,
): Promise<ProductionSummary> {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const today = todayKey(timezone);
  const [day, month, inRange] = await Promise.all([
    totals(orgId, { date: { $gte: startOfDay(today, timezone) } }),
    totals(orgId, { date: { $gte: startOfDay(startOfMonthKey(today), timezone) } }),
    totals(orgId, rangeFilter(range, timezone)),
  ]);
  return {
    todayGood: day.good,
    todayDefective: day.defective,
    monthGood: month.good,
    monthDefective: month.defective,
    rangeGood: inRange.good,
    rangeDefective: inRange.defective,
    rangeEntries: inRange.entries,
  };
}

/** Good and defective bricks per day for the last `days` days, oldest first. */
export async function dailyProduction(
  viewer: SessionUser,
  timezone: string,
  days = 30,
): Promise<ProductionDay[]> {
  await connectDb();
  const today = todayKey(timezone);
  const firstDay = addDays(today, -(days - 1));
  const rows = await ProductionEntry.aggregate<{ _id: string; good: number; defective: number }>([
    {
      $match: {
        orgId: new Types.ObjectId(viewer.orgId),
        voidedAt: null,
        date: { $gte: startOfDay(firstDay, timezone) },
      },
    },
    {
      $group: {
        _id: { $dateToString: { date: '$date', format: '%Y-%m-%d', timezone } },
        good: { $sum: '$goodQty' },
        defective: { $sum: '$defectiveQty' },
      },
    },
  ]).option({ maxTimeMS: 5_000 });

  const byDay = new Map(rows.map((row) => [row._id, row]));
  return dayRange(firstDay, today).map((day) => ({
    day,
    good: byDay.get(day)?.good ?? 0,
    defective: byDay.get(day)?.defective ?? 0,
  }));
}

/** Active brick types with their recipes resolved, for the log-production preview. */
export async function productionOptions(viewer: SessionUser): Promise<ProductOption[]> {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const [products, materials, locale] = await Promise.all([
    Product.find({ orgId, isActive: true }).sort({ name: 1 }).limit(100).lean(),
    RawMaterial.find({ orgId }).select('name nameHi unit quantityMilli').lean(),
    requestLocale(),
  ]);
  const byId = new Map(materials.map((material) => [material._id.toString(), material]));

  return products.map((product) => ({
    id: idToString(product._id),
    name: pickText(product.name, product.nameHi, locale),
    size: product.size,
    recipeBatchSize: product.recipeBatchSize,
    recipe: product.recipe.map((line) => {
      const material = byId.get(line.materialId.toString());
      return {
        materialId: line.materialId.toString(),
        materialName: material ? pickText(material.name, material.nameHi, locale) : '—',
        unit: material?.unit ?? 'kg',
        qtyMilli: line.qtyMilli,
        availableMilli: material?.quantityMilli ?? 0,
      };
    }),
  }));
}

export const PRODUCTION_GROUPS = ['day', 'week', 'month', 'brickType', 'person'] as const;
export type ProductionGroup = (typeof PRODUCTION_GROUPS)[number];

export type ProductionGroupRow = {
  key: string;
  /** Day key for time groups, otherwise the brick type or person name. */
  label: string;
  /** What opening this group filters the list by. */
  link: { from: string; to: string } | { productId: string } | { q: string };
  entries: number;
  good: number;
  defective: number;
};

/** Subtotals of bricks made per group, for the same filters as the list. Cancelled entries excluded. */
export async function groupProduction(
  viewer: SessionUser,
  group: ProductionGroup,
  filters: ProductionFilters,
  timezone: string,
): Promise<ProductionGroupRow[]> {
  await connectDb();
  const locale = await requestLocale();
  const key =
    group === 'brickType'
      ? '$productId'
      : group === 'person'
        ? '$createdByName'
        : timeBucketExpression('date', group, timezone);

  const rows = await ProductionEntry.aggregate<{
    _id: string | ObjectId;
    name: string;
    nameHi: string | null;
    entries: number;
    good: number;
    defective: number;
  }>([
    { $match: { ...productionFilter(viewer, filters, timezone), voidedAt: null } },
    {
      $group: {
        _id: key,
        name: { $last: group === 'person' ? '$createdByName' : '$productName' },
        nameHi: { $last: group === 'person' ? null : '$productNameHi' },
        entries: { $sum: 1 },
        good: { $sum: '$goodQty' },
        defective: { $sum: '$defectiveQty' },
      },
    },
    { $sort: { _id: group === 'brickType' || group === 'person' ? 1 : -1 } },
    { $limit: 400 },
  ]).option({ maxTimeMS: 5_000 });

  return rows.map((row) => {
    const id = row._id.toString();
    if (group === 'brickType') {
      return {
        key: id,
        label: pickText(row.name, row.nameHi, locale),
        link: { productId: id },
        entries: row.entries,
        good: row.good,
        defective: row.defective,
      };
    }
    if (group === 'person') {
      return {
        key: id,
        label: id,
        link: { q: id },
        entries: row.entries,
        good: row.good,
        defective: row.defective,
      };
    }
    return {
      key: id,
      label: id,
      link: bucketRange(id, group satisfies TimeUnit),
      entries: row.entries,
      good: row.good,
      defective: row.defective,
    };
  });
}
