import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';
import { MATERIAL_KINDS, UNITS, type MaterialKind, type Unit } from './constants';

/**
 * An ingredient in the yard. `quantityMilli` is the running balance (computed
 * pattern) kept in step with the movement ledger inside one transaction, so the
 * list screen reads one document per material instead of summing history.
 */
export type RawMaterialDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  name: string;
  /** Hindi name (Devanagari); `name` is English. */
  nameHi: string | null;
  kind: MaterialKind;
  unit: Unit;
  quantityMilli: number;
  /** At or below this the material is "low" and alert recipients are emailed. */
  lowThresholdMilli: number;
  /** Rough capacity of the storage (silo, shed) for the fill gauge. Optional. */
  capacityMilli: number | null;
  /** Paise per whole unit at the last purchase; shown as a hint, never trusted for totals. */
  lastRatePaise: number | null;
  /**
   * When the low-stock alert last fired. Cleared once stock rises above the
   * threshold again, so each dip alerts exactly once.
   */
  lowAlertedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const RawMaterialSchema = new Schema<RawMaterialDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nameHi: { type: String, default: null, trim: true, maxlength: 80 },
    kind: { type: String, enum: MATERIAL_KINDS, required: true, default: 'other' },
    unit: { type: String, enum: UNITS, required: true },
    quantityMilli: { type: Number, required: true, default: 0 },
    lowThresholdMilli: { type: Number, required: true, min: 0, default: 0 },
    capacityMilli: { type: Number, default: null, min: 0 },
    lastRatePaise: { type: Number, default: null, min: 0 },
    lowAlertedAt: { type: Date, default: null },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, collection: 'raw_materials', strict: 'throw' },
);

RawMaterialSchema.index(
  { orgId: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);
RawMaterialSchema.index({ orgId: 1, isActive: 1, name: 1 });

export const RawMaterial: Model<RawMaterialDoc> =
  (models.RawMaterial as Model<RawMaterialDoc> | undefined) ??
  model<RawMaterialDoc>('RawMaterial', RawMaterialSchema);
