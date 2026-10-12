import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';
import {
  PAYMENT_MODES,
  STAFF_PAYMENT_TYPES,
  type PaymentMode,
  type StaffPaymentType,
} from './constants';

/**
 * Money paid to (or taken back from) a worker. Append-only: a mistake is
 * voided with a reason, never edited or deleted, so the wage history always
 * adds up.
 */
export type StaffPaymentDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  staffId: ObjectId;
  type: StaffPaymentType;
  amountPaise: number;
  mode: PaymentMode;
  paidOn: Date;
  /** The work period a wage payment settles, when it settles one. */
  periodFrom: Date | null;
  periodTo: Date | null;
  note: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  recordedBy: ObjectId;
  recordedByName: string;
  createdAt: Date;
};

const StaffPaymentSchema = new Schema<StaffPaymentDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'StaffMember', required: true },
    type: { type: String, enum: STAFF_PAYMENT_TYPES, required: true },
    amountPaise: { type: Number, required: true, min: 1 },
    mode: { type: String, enum: PAYMENT_MODES, required: true },
    paidOn: { type: Date, required: true },
    periodFrom: { type: Date, default: null },
    periodTo: { type: Date, default: null },
    note: { type: String, default: null, trim: true, maxlength: 300 },
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, default: null, trim: true, maxlength: 300 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recordedByName: { type: String, required: true, maxlength: 120 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'staff_payments',
    strict: 'throw',
  },
);

StaffPaymentSchema.index({ orgId: 1, staffId: 1, paidOn: -1, _id: -1 });
StaffPaymentSchema.index({ orgId: 1, paidOn: -1, _id: -1 });

export const StaffPayment: Model<StaffPaymentDoc> =
  (models.StaffPayment as Model<StaffPaymentDoc> | undefined) ??
  model<StaffPaymentDoc>('StaffPayment', StaffPaymentSchema);
