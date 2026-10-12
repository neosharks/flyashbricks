import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';

export type ConsumptionLine = { materialId: ObjectId; qtyMilli: number };

/**
 * One production run: bricks pressed on a day for one brick type. Several per
 * day are normal (shifts, machines). Material consumption is computed from the
 * recipe at the time of entry and stored, so a later recipe change does not
 * rewrite history.
 */
export type ProductionEntryDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  productId: ObjectId;
  /** Copied for list views and history that outlives a rename. */
  productName: string;
  productNameHi: string | null;
  /** Start of the production day in the organisation's timezone. */
  date: Date;
  goodQty: number;
  defectiveQty: number;
  note: string | null;
  consumption: ConsumptionLine[];
  voidedAt: Date | null;
  voidReason: string | null;
  createdBy: ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
};

const ConsumptionLineSchema = new Schema<ConsumptionLine>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    qtyMilli: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const ProductionEntrySchema = new Schema<ProductionEntryDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true, maxlength: 80 },
    productNameHi: { type: String, default: null, maxlength: 80 },
    date: { type: Date, required: true },
    goodQty: { type: Number, required: true, min: 0 },
    defectiveQty: { type: Number, required: true, min: 0, default: 0 },
    note: { type: String, default: null, trim: true, maxlength: 500 },
    consumption: { type: [ConsumptionLineSchema], default: [] },
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, default: null, trim: true, maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true, maxlength: 120 },
  },
  { timestamps: true, collection: 'production_entries', strict: 'throw' },
);

ProductionEntrySchema.index({ orgId: 1, date: -1, _id: -1 });
ProductionEntrySchema.index({ orgId: 1, productId: 1, date: -1 });
// Sorting the list by broken bricks or brick type.
ProductionEntrySchema.index({ orgId: 1, defectiveQty: 1, _id: 1 });
ProductionEntrySchema.index({ orgId: 1, productName: 1, _id: 1 });

export const ProductionEntry: Model<ProductionEntryDoc> =
  (models.ProductionEntry as Model<ProductionEntryDoc> | undefined) ??
  model<ProductionEntryDoc>('ProductionEntry', ProductionEntrySchema);
