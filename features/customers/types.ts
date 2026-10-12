import type { StateCode } from '@/lib/gst';

export type CustomerRow = {
  id: string;
  /** In the reader's language (Hindi or English, falling back to the other). */
  name: string;
  /** Both scripts as stored, for forms and exports. */
  nameEn: string;
  nameHi: string | null;
  phones: string[];
  address: string | null;
  addressEn: string | null;
  addressHi: string | null;
  city: string | null;
  cityEn: string | null;
  cityHi: string | null;
  gstin: string | null;
  stateCode: StateCode | null;
  notes: string | null;
  billedPaise: number;
  paidPaise: number;
  duePaise: number;
  bricksBought: number;
  saleCount: number;
  lastSaleAt: string | null;
  createdAt: string;
};

/** What the sale form's customer picker needs. */
export type CustomerOption = {
  id: string;
  /** In the reader's language. */
  name: string;
  phone: string;
  city: string | null;
  duePaise: number;
  /** For the GST preview on the sale form: same state or not. */
  stateCode: StateCode | null;
  gstin: string | null;
};

export const CUSTOMER_GROUPS = ['city', 'dues', 'recency'] as const;
export type CustomerGroup = (typeof CUSTOMER_GROUPS)[number];

export const DUES_BRACKETS = ['none', 'upto10k', 'from10kTo50k', 'over50k'] as const;
export type DuesBracket = (typeof DUES_BRACKETS)[number];

export const RECENCY_BUCKETS = ['thisMonth', 'oneToThree', 'older', 'never'] as const;
export type RecencyBucket = (typeof RECENCY_BUCKETS)[number];

export type CustomerGroupRow = {
  key: string;
  /** The city in Hindi, for city groups. */
  keyHi?: string | null;
  customers: number;
  bills: number;
  bricks: number;
  billedPaise: number;
  duePaise: number;
};
