import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';
import { MATERIAL_MOVEMENT_TYPES, type MaterialMovementType } from './constants';

/** Append-only ledger of every change to a raw material's balance. */
export type MaterialMovementDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  materialId: ObjectId;
  type: MaterialMovementType;
  /** Signed: purchases are positive, consumption negative. */
  qtyMilli: number;
  balanceAfterMilli: number;
  /** Purchases only: what was paid in total. */
  costPaise: number | null;
  supplier: string | null;
  note: string | null;
  /** Set for consumption written by a production entry. */
  productionId: ObjectId | null;
  /** When it happened in the yard, which may be earlier than when it was typed in. */
  occurredAt: Date;
  createdBy: ObjectId;
  createdAt: Date;
};

const MaterialMovementSchema = new Schema<MaterialMovementDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    materialId: { type: Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    type: { type: String, enum: MATERIAL_MOVEMENT_TYPES, required: true },
    qtyMilli: { type: Number, required: true },
    balanceAfterMilli: { type: Number, required: true },
    costPaise: { type: Number, default: null, min: 0 },
    supplier: { type: String, default: null, trim: true, maxlength: 120 },
    note: { type: String, default: null, trim: true, maxlength: 500 },
    productionId: { type: Schema.Types.ObjectId, ref: 'ProductionEntry', default: null },
    occurredAt: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'material_movements',
    strict: 'throw',
  },
);

MaterialMovementSchema.index({ orgId: 1, materialId: 1, occurredAt: -1, _id: -1 });
// Runway: consumption per material over a recent window.
MaterialMovementSchema.index({ orgId: 1, type: 1, occurredAt: -1 });
MaterialMovementSchema.index({ orgId: 1, materialId: 1, qtyMilli: 1, _id: 1 });

export const MaterialMovement: Model<MaterialMovementDoc> =
  (models.MaterialMovement as Model<MaterialMovementDoc> | undefined) ??
  model<MaterialMovementDoc>('MaterialMovement', MaterialMovementSchema);
