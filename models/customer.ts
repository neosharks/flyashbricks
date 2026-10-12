import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';
import { STATE_CODES, type StateCode } from '@/lib/gst';
import { LIMITS } from './constants';

/**
 * A buyer, identified by phone number. A person can have several numbers, and
 * no two customers in one organisation may share one — that unique index is
 * what stops the same buyer being entered twice.
 *
 * The totals are a computed summary updated in the same transaction as every
 * sale and payment, so the customer list can sort by money owed without an
 * aggregation over all sales.
 */
export type CustomerDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  /** English (Latin script); also the sort key. */
  name: string;
  /** Hindi (Devanagari). */
  nameHi: string | null;
  /** Ten-digit Indian numbers, primary first. */
  phones: string[];
  address: string | null;
  addressHi: string | null;
  city: string | null;
  cityHi: string | null;
  gstin: string | null;
  /** GST state; decides CGST+SGST vs IGST. Null means the seller's own state. */
  stateCode: StateCode | null;
  notes: string | null;
  /** Lowercased name words and phone digits for prefix search. */
  searchTerms: string[];
  billedPaise: number;
  paidPaise: number;
  /** billed − paid; stored so the list can sort and filter on it. */
  duePaise: number;
  bricksBought: number;
  saleCount: number;
  lastSaleAt: Date | null;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const CustomerSchema = new Schema<CustomerDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameHi: { type: String, default: null, trim: true, maxlength: 120 },
    phones: {
      type: [{ type: String, match: /^[1-9]\d{9}$/ }],
      required: true,
      validate: {
        validator: (value: string[]) =>
          value.length >= 1 && value.length <= LIMITS.phonesPerCustomer,
        message: `A customer has between 1 and ${LIMITS.phonesPerCustomer} phone numbers`,
      },
    },
    address: { type: String, default: null, trim: true, maxlength: 300 },
    addressHi: { type: String, default: null, trim: true, maxlength: 300 },
    city: { type: String, default: null, trim: true, maxlength: 80 },
    cityHi: { type: String, default: null, trim: true, maxlength: 80 },
    gstin: { type: String, default: null, trim: true, uppercase: true, maxlength: 15 },
    stateCode: { type: String, enum: [...STATE_CODES, null], default: null },
    notes: { type: String, default: null, trim: true, maxlength: 1000 },
    searchTerms: { type: [String], default: [] },
    billedPaise: { type: Number, required: true, default: 0 },
    paidPaise: { type: Number, required: true, default: 0 },
    duePaise: { type: Number, required: true, default: 0 },
    bricksBought: { type: Number, required: true, default: 0 },
    saleCount: { type: Number, required: true, default: 0 },
    lastSaleAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'customers', strict: 'throw' },
);

CustomerSchema.index({ orgId: 1, phones: 1 }, { unique: true });
CustomerSchema.index({ orgId: 1, searchTerms: 1 });
CustomerSchema.index({ orgId: 1, name: 1, _id: 1 });
CustomerSchema.index({ orgId: 1, duePaise: -1, _id: -1 });
CustomerSchema.index({ orgId: 1, createdAt: -1, _id: -1 });
CustomerSchema.index({ orgId: 1, lastSaleAt: -1, _id: -1 });
CustomerSchema.index({ orgId: 1, bricksBought: -1, _id: -1 });
CustomerSchema.index({ orgId: 1, city: 1 });

export const Customer: Model<CustomerDoc> =
  (models.Customer as Model<CustomerDoc> | undefined) ??
  model<CustomerDoc>('Customer', CustomerSchema);
