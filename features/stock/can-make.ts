export type RecipeLine = { materialId: string; qtyMilli: number };

/**
 * How many more bricks the materials on record can make: the scarcest
 * ingredient decides. Null for a brick type with no recipe — there is
 * nothing to limit it, and "infinite" would be a lie.
 */
export function canMake(
  recipe: RecipeLine[],
  batchSize: number,
  balances: ReadonlyMap<string, number>,
): number | null {
  if (recipe.length === 0 || batchSize <= 0) return null;
  let best = Number.POSITIVE_INFINITY;
  for (const line of recipe) {
    if (line.qtyMilli <= 0) continue;
    const available = Math.max(0, balances.get(line.materialId) ?? 0);
    best = Math.min(best, Math.floor((available * batchSize) / line.qtyMilli));
  }
  return Number.isFinite(best) ? best : null;
}

/** The ingredient that runs out first, for "limited by cement". */
export function limitingMaterial(
  recipe: RecipeLine[],
  batchSize: number,
  balances: ReadonlyMap<string, number>,
): string | null {
  let limiting: string | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const line of recipe) {
    if (line.qtyMilli <= 0) continue;
    const bricks = (Math.max(0, balances.get(line.materialId) ?? 0) * batchSize) / line.qtyMilli;
    if (bricks < best) {
      best = bricks;
      limiting = line.materialId;
    }
  }
  return limiting;
}
