import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';
import { STATE_CODES, type StateCode } from '@/lib/gst';
import {
  LIMITS,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
  type PaymentMode,
  type PaymentStatus,
} from './constants';

export type SaleLine = {
  productId: ObjectId;
  productName: string;
  productNameHi: string | null;
  qty: number;
  /** What this customer was charged per brick on this bill. */
  ratePaise: number;
  /** The brick type's usual price when the bill was made, to show discounts and premiums. */
  defaultRatePaise: number;
  amountPaise: number;
};

export type SalePayment = {
  _id: ObjectId;
  amountPaise: number;
  mode: PaymentMode;
  paidAt: Date;
  note: string | null;
  recordedBy: ObjectId;
  recordedByName: string;
  createdAt: Date;
};

/** Who sold, as printed on the invoice at the time — a later profile edit must not rewrite it. */
export type InvoiceSeller = {
  name: string;
  nameHi: string | null;
  address: string | null;
  addressHi: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  stateCode: StateCode | null;
  hsnCode: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  upiId: string | null;
  terms: string | null;
};

/** Who bought, as of the sale. */
export type InvoiceBuyer = {
  name: string;
  nameHi: string | null;
  phone: string;
  address: string | null;
  addressHi: string | null;
  gstin: string | null;
  stateCode: StateCode | null;
};

/**
 * A sale of bricks to one customer. Lines hold the price at the time of sale
 * (deliberately denormalised — a later rate change must not rewrite old bills),
 * and payments are embedded because they are always read with the sale and are
 * bounded.
 */
export type SaleDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  /** Per-organisation sequence, shown as S-0001. */
  number: number;
  customerId: ObjectId;
  /** Extended reference so the list renders without a join. */
  customerName: string;
  customerNameHi: string | null;
  customerPhone: string;
  date: Date;
  lines: SaleLine[];
  bricks: number;
  /**
   * Goods value per brick, rounded: subtotal ÷ bricks, before delivery,
   * discount and tax. Stored so lists can sort and group by selling price.
   */
  avgRatePaise: number;
  /** Per financial year: INV/2026-27/0001. Every sale has one; a voided sale's invoice is cancelled, not reused. */
  invoiceNumber: string;
  seller: InvoiceSeller;
  buyer: InvoiceBuyer;
  subtotalPaise: number;
  deliveryPaise: number;
  discountPaise: number;
  /** subtotal + delivery − discount: the value GST is charged on. */
  taxablePaise: number;
  /** 0 when the seller has no GSTIN. */
  gstRateBps: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  /** taxable + tax: what the customer owes. */
  totalPaise: number;
  paidPaise: number;
  duePaise: number;
  status: PaymentStatus;
  payments: SalePayment[];
  vehicleNo: string | null;
  deliveryAddress: string | null;
  note: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  createdBy: ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
};

const SaleLineSchema = new Schema<SaleLine>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true, maxlength: 80 },
    productNameHi: { type: String, default: null, maxlength: 80 },
    qty: { type: Number, required: true, min: 1 },
    ratePaise: { type: Number, required: true, min: 0 },
    defaultRatePaise: { type: Number, required: true, min: 0 },
    amountPaise: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const SalePaymentSchema = new Schema<SalePayment>(
  {
    amountPaise: { type: Number, required: true, min: 1 },
    mode: { type: String, enum: PAYMENT_MODES, required: true },
    paidAt: { type: Date, required: true },
    note: { type: String, default: null, trim: true, maxlength: 300 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recordedByName: { type: String, required: true, maxlength: 120 },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: true },
);

const nullableString = (maxlength: number) => ({ type: String, default: null, maxlength });

const InvoiceSellerSchema = new Schema<InvoiceSeller>(
  {
    name: { type: String, required: true, maxlength: 160 },
    nameHi: nullableString(160),
    address: nullableString(400),
    addressHi: nullableString(400),
    phone: nullableString(10),
    email: nullableString(254),
    gstin: nullableString(15),
    stateCode: { type: String, enum: [...STATE_CODES, null], default: null },
    hsnCode: nullableString(8),
    bankAccountName: nullableString(120),
    bankAccountNumber: nullableString(20),
    bankIfsc: nullableString(11),
    bankName: nullableString(120),
    upiId: nullableString(80),
    terms: nullableString(1000),
  },
  { _id: false },
);

const InvoiceBuyerSchema = new Schema<InvoiceBuyer>(
  {
    name: { type: String, required: true, maxlength: 120 },
    nameHi: nullableString(120),
    phone: { type: String, required: true, maxlength: 10 },
    address: nullableString(400),
    addressHi: nullableString(400),
    gstin: nullableString(15),
    stateCode: { type: String, enum: [...STATE_CODES, null], default: null },
  },
  { _id: false },
);

const SaleSchema = new Schema<SaleDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    number: { type: Number, required: true, min: 1 },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String, required: true, maxlength: 120 },
    customerNameHi: { type: String, default: null, maxlength: 120 },
    customerPhone: { type: String, required: true, maxlength: 10 },
    date: { type: Date, required: true },
    lines: {
      type: [SaleLineSchema],
      required: true,
      validate: {
        validator: (value: SaleLine[]) => value.length >= 1 && value.length <= LIMITS.linesPerSale,
        message: `A sale has between 1 and ${LIMITS.linesPerSale} lines`,
      },
    },
    bricks: { type: Number, required: true, min: 1 },
    avgRatePaise: { type: Number, required: true, min: 0 },
    invoiceNumber: { type: String, required: true, maxlength: 16 },
    seller: { type: InvoiceSellerSchema, required: true },
    buyer: { type: InvoiceBuyerSchema, required: true },
    subtotalPaise: { type: Number, required: true, min: 0 },
    deliveryPaise: { type: Number, required: true, min: 0, default: 0 },
    discountPaise: { type: Number, required: true, min: 0, default: 0 },
    taxablePaise: { type: Number, required: true, min: 0 },
    gstRateBps: { type: Number, required: true, min: 0, default: 0 },
    cgstPaise: { type: Number, required: true, min: 0, default: 0 },
    sgstPaise: { type: Number, required: true, min: 0, default: 0 },
    igstPaise: { type: Number, required: true, min: 0, default: 0 },
    taxPaise: { type: Number, required: true, min: 0, default: 0 },
    totalPaise: { type: Number, required: true, min: 0 },
    paidPaise: { type: Number, required: true, min: 0, default: 0 },
    duePaise: { type: Number, required: true },
    status: { type: String, enum: PAYMENT_STATUSES, required: true },
    payments: {
      type: [SalePaymentSchema],
      default: [],
      validate: {
        validator: (value: SalePayment[]) => value.length <= LIMITS.paymentsPerSale,
        message: `A sale holds at most ${LIMITS.paymentsPerSale} payments`,
      },
    },
    vehicleNo: { type: String, default: null, trim: true, uppercase: true, maxlength: 20 },
    deliveryAddress: { type: String, default: null, trim: true, maxlength: 300 },
    note: { type: String, default: null, trim: true, maxlength: 500 },
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, default: null, trim: true, maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true, maxlength: 120 },
  },
  { timestamps: true, collection: 'sales', strict: 'throw' },
);

SaleSchema.index({ orgId: 1, number: 1 }, { unique: true });
SaleSchema.index({ orgId: 1, invoiceNumber: 1 }, { unique: true });
SaleSchema.index({ orgId: 1, date: -1, _id: -1 });
SaleSchema.index({ orgId: 1, customerId: 1, date: -1 });
SaleSchema.index({ orgId: 1, status: 1, date: -1 });
SaleSchema.index({ orgId: 1, totalPaise: -1, _id: -1 });
SaleSchema.index({ orgId: 1, duePaise: -1, _id: -1 });
SaleSchema.index({ orgId: 1, avgRatePaise: -1, _id: -1 });
SaleSchema.index({ orgId: 1, bricks: -1, _id: -1 });
SaleSchema.index({ orgId: 1, customerName: 1, _id: 1 });

export const Sale: Model<SaleDoc> =
  (models.Sale as Model<SaleDoc> | undefined) ?? model<SaleDoc>('Sale', SaleSchema);
