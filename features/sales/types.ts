import type { PaymentMode, PaymentStatus } from '@/models/constants';
import type { InvoiceBuyer, InvoiceSeller } from '@/models/sale';

export type SaleRow = {
  id: string;
  number: number;
  customerId: string;
  customerName: string;
  customerPhone: string;
  date: string;
  bricks: number;
  /** Goods value per brick on this bill. */
  avgRatePaise: number;
  /** "Standard 9×4×3 ×2000, Half ×300" — for the list's second line. */
  itemsSummary: string;
  totalPaise: number;
  paidPaise: number;
  duePaise: number;
  status: PaymentStatus;
  voided: boolean;
  /** Money still owed after more than 60 days: the one case shown in red. */
  overdue: boolean;
};

export type SalePaymentRow = {
  id: string;
  amountPaise: number;
  mode: PaymentMode;
  paidAt: string;
  note: string | null;
  recordedByName: string;
};

export type SaleDetail = SaleRow & {
  lines: {
    productId: string;
    /** In the reader's language; both scripts follow for the invoice. */
    productName: string;
    productNameEn: string;
    productNameHi: string | null;
    qty: number;
    ratePaise: number;
    defaultRatePaise: number;
    amountPaise: number;
  }[];
  subtotalPaise: number;
  deliveryPaise: number;
  discountPaise: number;
  invoiceNumber: string;
  seller: InvoiceSeller;
  buyer: InvoiceBuyer;
  taxablePaise: number;
  gstRateBps: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  payments: SalePaymentRow[];
  vehicleNo: string | null;
  deliveryAddress: string | null;
  note: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdByName: string;
  createdAt: string;
};

export type SalesSummary = {
  count: number;
  bricks: number;
  /** Goods value only — the base of the average price per brick. */
  subtotalPaise: number;
  totalPaise: number;
  paidPaise: number;
  duePaise: number;
  /** Lowest and highest per-bill price per brick in the range; 0 with no sales. */
  minRatePaise: number;
  maxRatePaise: number;
};

export const SALE_GROUPS = [
  'day',
  'week',
  'month',
  'customer',
  'product',
  'status',
  'price',
] as const;
export type SaleGroup = (typeof SALE_GROUPS)[number];

/** One row of "group by": subtotals for every sale (or line) that falls in it. */
export type SaleGroupRow = {
  key: string;
  /** Display name where the key is an id (customer, brick type). */
  name: string | null;
  bills: number;
  bricks: number;
  subtotalPaise: number;
  /** Null for brick-type groups: money on a bill is not split by brick type. */
  totalPaise: number | null;
  paidPaise: number | null;
  duePaise: number | null;
};

/** What a customer usually pays, for their page. */
export type CustomerPriceStats = {
  avgRatePaise: number | null;
  lastRatePaise: number | null;
  lastSaleAt: string | null;
};

export type AgeingRow = {
  bucket: 'd0_7' | 'd8_30' | 'd31_60' | 'd60';
  duePaise: number;
  count: number;
};

export type ProductOption = {
  id: string;
  name: string;
  size: string | null;
  stockGood: number;
  defaultRatePaise: number;
};

/** A payment with the sale it was recorded against, for the customer page. */
export type CustomerPaymentRow = SalePaymentRow & { saleId: string; saleNumber: number };
