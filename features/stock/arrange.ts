import type { ProductRow } from './types';

export const PRODUCT_CARD_SORTS = ['name', 'stockHigh', 'stockLow', 'canMake'] as const;
export type ProductCardSort = (typeof PRODUCT_CARD_SORTS)[number];

export function parseCardSort(raw: string | undefined): ProductCardSort {
  return PRODUCT_CARD_SORTS.find((value) => value === raw) ?? 'name';
}

/**
 * Brick-type cards filtered and ordered in memory: a yard has a handful of
 * brick types (the query caps at 100), so this needs no round trip or index.
 * Inactive types always sink below active ones, whatever the order.
 */
export function arrangeProducts(
  rows: ProductRow[],
  q: string,
  sort: ProductCardSort,
): ProductRow[] {
  const needle = q.trim().toLowerCase();
  const matched = needle
    ? rows.filter(
        (row) =>
          row.name.toLowerCase().includes(needle) ||
          (row.size ?? '').toLowerCase().includes(needle),
      )
    : rows;

  const compare: Record<ProductCardSort, (a: ProductRow, b: ProductRow) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    stockHigh: (a, b) => b.stockGood - a.stockGood,
    stockLow: (a, b) => a.stockGood - b.stockGood,
    canMake: (a, b) => (b.canMake ?? -1) - (a.canMake ?? -1),
  };

  return matched.toSorted(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) ||
      compare[sort](a, b) ||
      a.name.localeCompare(b.name),
  );
}
