import { consumptionFor } from '@/lib/quantity';

export type PreviewLine = {
  materialId: string;
  /** Milli-units the entry will take from the yard. */
  needMilli: number;
  availableMilli: number;
  short: boolean;
};

/**
 * Materials a production entry consumes: the recipe scaled to every brick
 * pressed — good and defective alike, because a cracked brick used the same
 * cement. Shared by the form's live preview and the server, so what the person
 * sees is exactly what will be deducted.
 */
export function plannedConsumption(
  recipe: { materialId: string; qtyMilli: number }[],
  batchSize: number,
  bricks: number,
  balances: ReadonlyMap<string, number>,
): PreviewLine[] {
  if (bricks <= 0) return [];
  return recipe
    .map((line) => {
      const needMilli = consumptionFor(bricks, line.qtyMilli, batchSize);
      const availableMilli = balances.get(line.materialId) ?? 0;
      return {
        materialId: line.materialId,
        needMilli,
        availableMilli,
        short: needMilli > availableMilli,
      };
    })
    .filter((line) => line.needMilli > 0);
}

/** Defective share of everything pressed, 0–1; null when nothing was made. */
export function defectRate(good: number, defective: number): number | null {
  const total = good + defective;
  return total > 0 ? defective / total : null;
}
