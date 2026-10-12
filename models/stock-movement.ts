import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';
import { STOCK_MOVEMENT_TYPES, type StockMovementType } from './constants';

/** Append-only ledger of every change to a brick type's sellable stock. */
export type StockMovementDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  productId: ObjectId;
  type: StockMovementType;
  /** Signed brick count. */
  qty: number;
  balanceAfter: number;
  /** The production entry or sale that caused it. */
  refId: ObjectId | null;
  note: string | null;
  occurredAt: Date;
  createdBy: ObjectId;
  createdAt: Date;
};

const StockMovementSchema = new Schema<StockMovementDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    type: { type: String, enum: STOCK_MOVEMENT_TYPES, required: true },
    qty: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    refId: { type: Schema.Types.ObjectId, default: null },
    note: { type: String, default: null, trim: true, maxlength: 500 },
    occurredAt: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'stock_movements',
    strict: 'throw',
  },
);

StockMovementSchema.index({ orgId: 1, productId: 1, occurredAt: -1, _id: -1 });
StockMovementSchema.index({ orgId: 1, occurredAt: -1, _id: -1 });
StockMovementSchema.index({ orgId: 1, qty: 1, _id: 1 });

export const StockMovement: Model<StockMovementDoc> =
  (models.StockMovement as Model<StockMovementDoc> | undefined) ??
  model<StockMovementDoc>('StockMovement', StockMovementSchema);
