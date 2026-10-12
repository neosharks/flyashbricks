import type { Unit } from '@/models/constants';

export type ProductionEntryRow = {
  id: string;
  productId: string;
  productName: string;
  /** The production day, `YYYY-MM-DD` in the organisation's timezone. */
  day: string;
  goodQty: number;
  defectiveQty: number;
  note: string | null;
  consumption: { materialId: string; materialName: string; unit: Unit; qtyMilli: number }[];
  voided: boolean;
  voidReason: string | null;
  createdByName: string;
  createdAt: string;
};

export type ProductionSummary = {
  todayGood: number;
  todayDefective: number;
  monthGood: number;
  monthDefective: number;
  rangeGood: number;
  rangeDefective: number;
  rangeEntries: number;
};

export type ProductionDay = { day: string; good: number; defective: number };

/** What the log-production dialog needs per brick type for its live preview. */
export type ProductOption = {
  id: string;
  name: string;
  size: string | null;
  recipeBatchSize: number;
  recipe: {
    materialId: string;
    materialName: string;
    unit: Unit;
    qtyMilli: number;
    availableMilli: number;
  }[];
};
