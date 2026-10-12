import type { Level } from '@/components/ui/meter';
import type { MaterialKind, MaterialMovementType, Unit } from '@/models/constants';

export type MaterialRow = {
  id: string;
  /** In the reader's language; both scripts follow for the edit form. */
  name: string;
  nameEn: string;
  nameHi: string | null;
  kind: MaterialKind;
  unit: Unit;
  quantityMilli: number;
  lowThresholdMilli: number;
  capacityMilli: number | null;
  lastRatePaise: number | null;
  isActive: boolean;
  level: Level;
  fill: number;
  /** Average daily use over the forecast window, or null without history. */
  dailyUseMilli: number | null;
  runwayDays: number | null;
};

export type MaterialOption = { id: string; name: string; unit: Unit; quantityMilli: number };

export type MaterialMovementRow = {
  id: string;
  type: MaterialMovementType;
  qtyMilli: number;
  balanceAfterMilli: number;
  costPaise: number | null;
  supplier: string | null;
  note: string | null;
  productionId: string | null;
  occurredAt: string;
  createdByName: string | null;
};
