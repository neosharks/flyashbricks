import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';
import { LIMITS } from './constants';

export type RecipeItem = {
  materialId: ObjectId;
  /** Material used for every `recipeBatchSize` bricks, in the material's milli-units. */
  qtyMilli: number;
};

/**
 * A kind of brick the yard makes (size, grade). Its recipe drives automatic
 * raw material consumption and the "days left" forecast. `stockGood` is the
 * running count of sellable bricks, kept in step with the stock ledger.
 */
export type ProductDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  name: string;
  /** Hindi name (Devanagari); `name` is English. */
  nameHi: string | null;
  /** e.g. "230 × 110 × 75 mm". */
  size: string | null;
  defaultRatePaise: number;
  recipeBatchSize: number;
  recipe: RecipeItem[];
  stockGood: number;
  lowStockThreshold: number;
  lowAlertedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const RecipeItemSchema = new Schema<RecipeItem>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    qtyMilli: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const ProductSchema = new Schema<ProductDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nameHi: { type: String, default: null, trim: true, maxlength: 80 },
    size: { type: String, default: null, trim: true, maxlength: 60 },
    defaultRatePaise: { type: Number, required: true, min: 0, default: 0 },
    recipeBatchSize: { type: Number, required: true, min: 1, max: 100_000, default: 100 },
    recipe: {
      type: [RecipeItemSchema],
      default: [],
      validate: {
        validator: (value: RecipeItem[]) => value.length <= LIMITS.recipeItems,
        message: `A recipe holds at most ${LIMITS.recipeItems} materials`,
      },
    },
    stockGood: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 0 },
    lowAlertedAt: { type: Date, default: null },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, collection: 'products', strict: 'throw' },
);

ProductSchema.index(
  { orgId: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);
ProductSchema.index({ orgId: 1, isActive: 1, name: 1 });

export const Product: Model<ProductDoc> =
  (models.Product as Model<ProductDoc> | undefined) ?? model<ProductDoc>('Product', ProductSchema);
