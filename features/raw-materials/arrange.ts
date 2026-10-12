import type { MaterialRow } from './types';

export const MATERIAL_SORTS = ['name', 'level', 'daysLeft', 'quantity'] as const;
export type MaterialSort = (typeof MATERIAL_SORTS)[number];

export const MATERIAL_SHOW = ['active', 'low', 'inactive', 'all'] as const;
export type MaterialShow = (typeof MATERIAL_SHOW)[number];

export function parseMaterialSort(raw: string | undefined): MaterialSort {
  return MATERIAL_SORTS.find((value) => value === raw) ?? 'level';
}

export function parseMaterialShow(raw: string | undefined): MaterialShow {
  return MATERIAL_SHOW.find((value) => value === raw) ?? 'active';
}

const LEVEL_RANK = { critical: 0, warning: 1, good: 2 } as const;

/**
 * The materials list, filtered and ordered in memory: a yard tracks a handful
 * of materials (the query caps at 200), so this needs no extra round trip.
 *
 * "Level" puts what needs ordering first, and within a level what runs out
 * soonest — the order someone checking the yard actually wants.
 */
export function arrangeMaterials(
  rows: MaterialRow[],
  options: { q: string; sort: MaterialSort; show: MaterialShow },
): MaterialRow[] {
  const needle = options.q.trim().toLowerCase();
  const shown = rows.filter((row) => {
    if (needle && !row.name.toLowerCase().includes(needle)) return false;
    switch (options.show) {
      case 'active':
        return row.isActive;
      case 'low':
        return row.isActive && row.level !== 'good';
      case 'inactive':
        return !row.isActive;
      case 'all':
        return true;
    }
  });

  // Unknown runway sorts last: it means no recent use, not an empty silo.
  const daysLeft = (row: MaterialRow) => row.runwayDays ?? Number.POSITIVE_INFINITY;
  const compare: Record<MaterialSort, (a: MaterialRow, b: MaterialRow) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    level: (a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || daysLeft(a) - daysLeft(b),
    daysLeft: (a, b) => daysLeft(a) - daysLeft(b),
    quantity: (a, b) => a.fill - b.fill,
  };

  return shown.toSorted((a, b) => compare[options.sort](a, b) || a.name.localeCompare(b.name));
}
