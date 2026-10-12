import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';
import { DEFAULT_TIMEZONE } from '@/lib/dates';
import { DEFAULT_STATE_CODE, STATE_CODES, type StateCode } from '@/lib/gst';

export type BankDetails = {
  accountName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  bankName: string | null;
};

/**
 * A company. Every other document carries its `orgId`, and every query is
 * scoped by the `orgId` of the signed-in user — never by one from the request.
 *
 * The business profile below is what invoices print. GST is optional: with no
 * `gstin`, invoices carry no tax whatever `gstRateBps` says.
 */
export type OrganizationDoc = {
  _id: ObjectId;
  name: string;
  nameHi: string | null;
  /** Registered name for invoices when it differs from the trading name. */
  legalName: string | null;
  legalNameHi: string | null;
  address: string | null;
  addressHi: string | null;
  city: string | null;
  pincode: string | null;
  stateCode: StateCode | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  /** Basis points: 500 = 5%. */
  gstRateBps: number;
  /** HSN code printed on invoice lines. */
  hsnCode: string | null;
  /** Up to 5 characters, so numbers fit GST's 16-character limit: INV/2026-27/0001. */
  invoicePrefix: string;
  bank: BankDetails;
  upiId: string | null;
  invoiceTerms: string | null;
  /** IANA zone the yard runs on; decides where "today" starts and ends. */
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
};

const BankSchema = new Schema<BankDetails>(
  {
    accountName: { type: String, default: null, trim: true, maxlength: 120 },
    accountNumber: { type: String, default: null, trim: true, maxlength: 20 },
    ifsc: { type: String, default: null, trim: true, uppercase: true, maxlength: 11 },
    bankName: { type: String, default: null, trim: true, maxlength: 120 },
  },
  { _id: false },
);

const OrganizationSchema = new Schema<OrganizationDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameHi: { type: String, default: null, trim: true, maxlength: 120 },
    legalName: { type: String, default: null, trim: true, maxlength: 160 },
    legalNameHi: { type: String, default: null, trim: true, maxlength: 160 },
    address: { type: String, default: null, trim: true, maxlength: 300 },
    addressHi: { type: String, default: null, trim: true, maxlength: 300 },
    city: { type: String, default: null, trim: true, maxlength: 80 },
    pincode: { type: String, default: null, match: /^[1-9]\d{5}$/ },
    stateCode: { type: String, enum: [...STATE_CODES, null], default: DEFAULT_STATE_CODE },
    phone: { type: String, default: null, match: /^[1-9]\d{9}$/ },
    email: { type: String, default: null, lowercase: true, trim: true, maxlength: 254 },
    gstin: { type: String, default: null, uppercase: true, trim: true, maxlength: 15 },
    gstRateBps: { type: Number, required: true, min: 0, max: 2_800, default: 0 },
    hsnCode: { type: String, default: '6815', trim: true, maxlength: 8 },
    invoicePrefix: { type: String, required: true, default: 'INV', trim: true, maxlength: 5 },
    bank: { type: BankSchema, default: () => ({}) },
    upiId: { type: String, default: null, trim: true, maxlength: 80 },
    invoiceTerms: { type: String, default: null, trim: true, maxlength: 1000 },
    timezone: { type: String, required: true, default: DEFAULT_TIMEZONE, maxlength: 60 },
  },
  { timestamps: true, collection: 'organizations', strict: 'throw' },
);

export const Organization: Model<OrganizationDoc> =
  (models.Organization as Model<OrganizationDoc> | undefined) ??
  model<OrganizationDoc>('Organization', OrganizationSchema);
