import type { Level } from '@/components/ui/meter';
import type { StockMovementType, Unit } from '@/models/constants';

export type RecipeRow = {
  materialId: string;
  materialName: string;
  unit: Unit;
  qtyMilli: number;
  /** What the yard holds now, for the "can make" and preview maths. */
  availableMilli: number;
};

export type ProductRow = {
  id: string;
  /** In the reader's language; both scripts follow for the edit form. */
  name: string;
  nameEn: string;
  nameHi: string | null;
  size: string | null;
  defaultRatePaise: number;
  recipeBatchSize: number;
  recipe: RecipeRow[];
  stockGood: number;
  lowStockThreshold: number;
  isActive: boolean;
  level: Level;
  canMake: number | null;
  limitingMaterial: string | null;
};

export type StockMovementRow = {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  qty: number;
  balanceAfter: number;
  refId: string | null;
  note: string | null;
  occurredAt: string;
  createdByName: string | null;
};
