import 'server-only';
import { pickText } from '@/lib/bilingual';
import { requestLocale } from '@/lib/locale';
import { Types, type ObjectId, type QueryFilter } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { dateToIso, idToString, optionalIdToString } from '@/lib/dto';
import { addDays, startOfDay } from '@/lib/dates';
import type { SessionUser } from '@/lib/permissions';
import { keysetPage, type Page, type TableParams } from '@/lib/table';
import { Product, type ProductDoc } from '@/models/product';
import { RawMaterial } from '@/models/raw-material';
import { StockMovement, type StockMovementDoc } from '@/models/stock-movement';
import type { StockMovementType } from '@/models/constants';
import type { DayRange } from '@/features/production/range';
import { stockLevel } from '@/features/raw-materials/forecast';
import { userNames } from '@/features/raw-materials/queries';
import { canMake, limitingMaterial } from './can-make';
import { prefixRegex, timeBucketExpression } from '@/features/production/grouping';
import type { ProductRow, StockMovementRow } from './types';

async function materialLookup(orgId: ObjectId) {
  const materials = await RawMaterial.find({ orgId })
    .select('name nameHi unit quantityMilli')
    .lean();
  return new Map(materials.map((material) => [material._id.toString(), material]));
}

function toProductRow(
  doc: ProductDoc,
  materials: Awaited<ReturnType<typeof materialLookup>>,
  locale: 'en' | 'hi',
): ProductRow {
  const recipe = doc.recipe.map((line) => {
    const material = materials.get(line.materialId.toString());
    return {
      materialId: line.materialId.toString(),
      materialName: material ? pickText(material.name, material.nameHi, locale) : '—',
      unit: material?.unit ?? 'kg',
      qtyMilli: line.qtyMilli,
      availableMilli: material?.quantityMilli ?? 0,
    };
  });
  const balances = new Map(recipe.map((line) => [line.materialId, line.availableMilli]));
  const limiting = limitingMaterial(recipe, doc.recipeBatchSize, balances);

  return {
    id: idToString(doc._id),
    name: pickText(doc.name, doc.nameHi, locale),
    nameEn: doc.name,
    nameHi: doc.nameHi ?? null,
    size: doc.size,
    defaultRatePaise: doc.defaultRatePaise,
    recipeBatchSize: doc.recipeBatchSize,
    recipe,
    stockGood: doc.stockGood,
    lowStockThreshold: doc.lowStockThreshold,
    isActive: doc.isActive,
    level: stockLevel(doc.stockGood, doc.lowStockThreshold),
    canMake: canMake(recipe, doc.recipeBatchSize, balances),
    limitingMaterial: limiting
      ? (recipe.find((line) => line.materialId === limiting)?.materialName ?? null)
      : null,
  };
}

export async function listProducts(
  viewer: SessionUser,
  options: { activeOnly?: boolean } = {},
): Promise<ProductRow[]> {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const [docs, materials, locale] = await Promise.all([
    Product.find({ orgId, ...(options.activeOnly ? { isActive: true } : {}) })
      .sort({ isActive: -1, name: 1 })
      .limit(100)
      .lean(),
    materialLookup(orgId),
    requestLocale(),
  ]);
  return docs.map((doc) => toProductRow(doc, materials, locale));
}

export const STOCK_MOVEMENT_SORTS = ['occurredAt', 'qty'] as const;
export type StockMovementSort = (typeof STOCK_MOVEMENT_SORTS)[number];

export type StockMovementFilters = {
  productId: string | null;
  type: StockMovementType | null;
  range: DayRange;
  q: string;
};

function stockMovementFilter(
  viewer: SessionUser,
  filters: StockMovementFilters,
  timezone: string,
): QueryFilter<StockMovementDoc> {
  const filter: QueryFilter<StockMovementDoc> = { orgId: new Types.ObjectId(viewer.orgId) };
  if (filters.productId && Types.ObjectId.isValid(filters.productId)) {
    filter.productId = new Types.ObjectId(filters.productId);
  }
  if (filters.type) filter.type = filters.type;
  if (filters.range.from || filters.range.to) {
    filter.occurredAt = {
      ...(filters.range.from ? { $gte: startOfDay(filters.range.from, timezone) } : {}),
      ...(filters.range.to ? { $lt: startOfDay(addDays(filters.range.to, 1), timezone) } : {}),
    };
  }
  if (filters.q) filter.note = prefixRegex(filters.q);
  return filter;
}

export async function listStockMovements(
  viewer: SessionUser,
  params: TableParams<StockMovementSort> & StockMovementFilters,
  timezone: string,
): Promise<Page<StockMovementRow>> {
  await connectDb();
  const orgId = new Types.ObjectId(viewer.orgId);
  const filter = stockMovementFilter(viewer, params, timezone);

  const page = await keysetPage(StockMovement, filter, params);
  const [names, products, locale] = await Promise.all([
    userNames(page.rows.map((row) => row.createdBy)),
    Product.find({
      orgId,
      _id: { $in: [...new Set(page.rows.map((row) => row.productId.toString()))] },
    })
      .select('name nameHi')
      .lean(),
    requestLocale(),
  ]);
  const productNames = new Map(
    products.map((product) => [
      product._id.toString(),
      pickText(product.name, product.nameHi, locale),
    ]),
  );

  return {
    ...page,
    rows: page.rows.map((row) => ({
      id: idToString(row._id),
      productId: idToString(row.productId),
      productName: productNames.get(row.productId.toString()) ?? '—',
      type: row.type,
      qty: row.qty,
      balanceAfter: row.balanceAfter,
      refId: optionalIdToString(row.refId),
      note: row.note,
      occurredAt: dateToIso(row.occurredAt),
      createdByName: names.get(row.createdBy.toString()) ?? null,
    })),
  };
}

export const STOCK_MOVEMENT_GROUPS = ['type', 'month'] as const;
export type StockMovementGroup = (typeof STOCK_MOVEMENT_GROUPS)[number];

export type StockMovementGroupRow = {
  /** The movement type, or the month's first day key. */
  key: string;
  changes: number;
  bricksIn: number;
  bricksOut: number;
};

/** Bricks added and taken out per kind of change or per month, for the same filters as the list. */
export async function groupStockMovements(
  viewer: SessionUser,
  group: StockMovementGroup,
  filters: StockMovementFilters,
  timezone: string,
): Promise<StockMovementGroupRow[]> {
  await connectDb();
  const rows = await StockMovement.aggregate<{
    _id: string;
    changes: number;
    bricksIn: number;
    bricksOut: number;
  }>([
    { $match: stockMovementFilter(viewer, filters, timezone) },
    {
      $group: {
        _id: group === 'type' ? '$type' : timeBucketExpression('occurredAt', 'month', timezone),
        changes: { $sum: 1 },
        bricksIn: { $sum: { $cond: [{ $gt: ['$qty', 0] }, '$qty', 0] } },
        bricksOut: { $sum: { $cond: [{ $lt: ['$qty', 0] }, { $multiply: ['$qty', -1] }, 0] } },
      },
    },
    { $sort: { _id: group === 'type' ? 1 : -1 } },
    { $limit: 400 },
  ]).option({ maxTimeMS: 5_000 });

  return rows.map((row) => ({
    key: row._id,
    changes: row.changes,
    bricksIn: row.bricksIn,
    bricksOut: row.bricksOut,
  }));
}
