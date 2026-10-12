import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';

export const ASSET_PURPOSES = ['avatar', 'staff_photo'] as const;
export type AssetPurpose = (typeof ASSET_PURPOSES)[number];

export const IMAGE_VARIANTS = ['thumb', 'medium', 'large'] as const;
export type ImageVariant = (typeof IMAGE_VARIANTS)[number];

export type AssetVariant = { key: string; width: number; height: number; bytes: number };

/**
 * An uploaded file and its stored versions. The bytes live in the storage
 * driver; this document is what the app checks before serving any of them,
 * and the sum of `bytes` is what the per-organisation quota counts.
 */
export type AssetDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  purpose: AssetPurpose;
  /** The record it belongs to, e.g. the user whose photo it is. */
  ownerId: ObjectId;
  contentType: string;
  variants: Record<ImageVariant, AssetVariant>;
  /** Sum of every stored variant, after compression. */
  bytes: number;
  /** Size of what the browser sent, before compression — for the record. */
  originalBytes: number;
  createdBy: ObjectId;
  createdAt: Date;
};

const VariantSchema = new Schema<AssetVariant>(
  {
    key: { type: String, required: true, maxlength: 200 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    bytes: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const AssetSchema = new Schema<AssetDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    purpose: { type: String, enum: ASSET_PURPOSES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    contentType: { type: String, required: true, maxlength: 60 },
    variants: {
      thumb: { type: VariantSchema, required: true },
      medium: { type: VariantSchema, required: true },
      large: { type: VariantSchema, required: true },
    },
    bytes: { type: Number, required: true, min: 0 },
    originalBytes: { type: Number, required: true, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'assets', strict: 'throw' },
);

AssetSchema.index({ orgId: 1, purpose: 1, ownerId: 1 });
// The quota sum.
AssetSchema.index({ orgId: 1, bytes: 1 });

export const Asset: Model<AssetDoc> =
  (models.Asset as Model<AssetDoc> | undefined) ?? model<AssetDoc>('Asset', AssetSchema);
