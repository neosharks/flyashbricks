import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';

/**
 * A quick-sign-in PIN for one person on one device. The device holds a random
 * token in a cookie; only its SHA-256 is stored, so a database copy cannot be
 * turned back into a working cookie.
 */
export type DeviceCredentialDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  pinHash: string;
  /** Wrong PINs since the last right one; the credential is deleted at the limit. */
  failedAttempts: number;
  /** "Chrome · Android", so the person can tell their devices apart; empty when unknown. */
  label: string;
  lastUsedAt: Date | null;
  /** Pushed forward on every use; MongoDB deletes the credential once it passes. */
  expiresAt: Date;
  createdAt: Date;
};

const DeviceCredentialSchema = new Schema<DeviceCredentialDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    pinHash: { type: String, required: true, select: false },
    failedAttempts: { type: Number, required: true, min: 0, default: 0 },
    label: { type: String, default: '', maxlength: 80 },
    lastUsedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'device_credentials',
    strict: 'throw',
  },
);

DeviceCredentialSchema.index({ tokenHash: 1 }, { unique: true });
DeviceCredentialSchema.index({ orgId: 1, userId: 1, createdAt: -1 });
DeviceCredentialSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const DeviceCredential: Model<DeviceCredentialDoc> =
  (models.DeviceCredential as Model<DeviceCredentialDoc> | undefined) ??
  model<DeviceCredentialDoc>('DeviceCredential', DeviceCredentialSchema);
