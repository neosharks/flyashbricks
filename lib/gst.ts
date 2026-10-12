/**
 * Indian GST for a single-rate seller.
 *
 * GST is optional: an organisation without a GSTIN issues plain invoices
 * ("bill of supply") with no tax. With one, tax is charged on the taxable
 * value (goods + delivery − discount): CGST + SGST in equal halves when the
 * buyer is in the seller's state, IGST otherwise.
 *
 * Rates are basis points (500 = 5%) and every amount is integer paise.
 */

/** GST state and union-territory codes, as used in the first two digits of a GSTIN. */
export const GST_STATES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
} as const;

export type StateCode = keyof typeof GST_STATES;

/** Where the business and its customers are assumed to be until someone says otherwise. */
export const DEFAULT_STATE_CODE: StateCode = '09'; // Uttar Pradesh
export const STATE_CODES = Object.keys(GST_STATES) as StateCode[];

export function isStateCode(value: unknown): value is StateCode {
  return typeof value === 'string' && value in GST_STATES;
}

/** 2-digit state code, 10-character PAN, entity number, `Z`, check character. */
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Format plus the official check character (a weighted base-36 checksum), so
 * a single mistyped character is caught before it reaches an invoice.
 */
export function isValidGstin(value: string): boolean {
  if (!GSTIN_PATTERN.test(value) || !isStateCode(value.slice(0, 2))) return false;
  let sum = 0;
  for (let index = 0; index < 14; index += 1) {
    const product = GSTIN_CHARS.indexOf(value.charAt(index)) * (index % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  const check = GSTIN_CHARS.charAt((36 - (sum % 36)) % 36);
  return value.charAt(14) === check;
}

export function stateFromGstin(gstin: string): StateCode | null {
  const code = gstin.slice(0, 2);
  return isStateCode(code) ? code : null;
}

export type GstBreakdown = {
  taxablePaise: number;
  rateBps: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  totalPaise: number;
  interState: boolean;
};

/**
 * Tax on a taxable value. `rateBps` of 0 (or no seller GSTIN) means no tax.
 * Intra-state tax is split into two halves rounded separately, the way it is
 * printed, so CGST + SGST always equals the tax line exactly.
 */
export function computeGst(input: {
  taxablePaise: number;
  rateBps: number;
  sellerState: StateCode | null;
  buyerState: StateCode | null;
}): GstBreakdown {
  const { taxablePaise, rateBps } = input;
  // Unknown buyer state is treated as the seller's: a sale at the yard gate.
  const interState =
    input.sellerState !== null &&
    input.buyerState !== null &&
    input.buyerState !== input.sellerState;

  if (rateBps <= 0) {
    return {
      taxablePaise,
      rateBps: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      taxPaise: 0,
      totalPaise: taxablePaise,
      interState,
    };
  }

  if (interState) {
    const igstPaise = Math.round((taxablePaise * rateBps) / 10_000);
    return {
      taxablePaise,
      rateBps,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise,
      taxPaise: igstPaise,
      totalPaise: taxablePaise + igstPaise,
      interState,
    };
  }

  const half = Math.round((taxablePaise * rateBps) / 20_000);
  return {
    taxablePaise,
    rateBps,
    cgstPaise: half,
    sgstPaise: half,
    igstPaise: 0,
    taxPaise: half * 2,
    totalPaise: taxablePaise + half * 2,
    interState,
  };
}

/** Indian financial year label for a date in IST: April–March, e.g. "2026-27". */
export function financialYear(date: Date): string {
  const ist = new Date(date.getTime() + 330 * 60_000);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** GST invoice numbers: at most 16 characters, unique within a financial year. */
export function formatInvoiceNumber(prefix: string, fy: string, sequence: number): string {
  return `${prefix}/${fy}/${String(sequence).padStart(4, '0')}`;
}
