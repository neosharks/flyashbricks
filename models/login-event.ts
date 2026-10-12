import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';

/**
 * One row per sign-in attempt against a known account. Attempts against
 * unknown identifiers are logged, not stored: they belong to no organisation.
 */
export type LoginEventDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  userId: ObjectId;
  success: boolean;
  /** Why it failed, when it did: `bad_password`, `disabled`. */
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
};

const LoginEventSchema = new Schema<LoginEventDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    success: { type: Boolean, required: true },
    reason: { type: String, default: null, maxlength: 40 },
    ip: { type: String, default: null, maxlength: 64 },
    userAgent: { type: String, default: null, maxlength: 300 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'login_events',
    strict: 'throw',
  },
);

LoginEventSchema.index({ orgId: 1, userId: 1, createdAt: -1 });
LoginEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 400 });

export const LoginEvent: Model<LoginEventDoc> =
  (models.LoginEvent as Model<LoginEventDoc> | undefined) ??
  model<LoginEventDoc>('LoginEvent', LoginEventSchema);
