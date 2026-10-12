import { describe, expect, it } from 'vitest';
import {
  computeGst,
  financialYear,
  formatInvoiceNumber,
  isValidGstin,
  stateFromGstin,
} from './gst';

describe('isValidGstin', () => {
  it('accepts a GSTIN with a correct check character', () => {
    expect(isValidGstin('27AAPFU0939F1ZV')).toBe(true);
  });

  it('rejects a single mistyped character', () => {
    expect(isValidGstin('27AAPFU0939F1ZW')).toBe(false);
    expect(isValidGstin('27AAPFU0938F1ZV')).toBe(false);
  });

  it('rejects the wrong shape or an unknown state code', () => {
    expect(isValidGstin('27AAPFU0939F1V')).toBe(false);
    expect(isValidGstin('99AAPFU0939F1ZV')).toBe(false);
    expect(isValidGstin('27aapfu0939f1zv')).toBe(false);
  });

  it('reads the state from the first two digits', () => {
    expect(stateFromGstin('27AAPFU0939F1ZV')).toBe('27');
  });
});

describe('computeGst', () => {
  it('splits intra-state tax into equal CGST and SGST', () => {
    const tax = computeGst({
      taxablePaise: 1_000_000,
      rateBps: 500,
      sellerState: '08',
      buyerState: '08',
    });
    expect(tax).toMatchObject({
      cgstPaise: 25_000,
      sgstPaise: 25_000,
      igstPaise: 0,
      taxPaise: 50_000,
    });
    expect(tax.totalPaise).toBe(1_050_000);
  });

  it('charges IGST when the buyer is in another state', () => {
    const tax = computeGst({
      taxablePaise: 1_000_000,
      rateBps: 1_200,
      sellerState: '08',
      buyerState: '09',
    });
    expect(tax).toMatchObject({ igstPaise: 120_000, cgstPaise: 0, sgstPaise: 0, interState: true });
  });

  it('treats an unknown buyer state as local', () => {
    expect(
      computeGst({ taxablePaise: 10_000, rateBps: 500, sellerState: '08', buyerState: null })
        .interState,
    ).toBe(false);
  });

  it('keeps CGST + SGST equal to the tax line even when the halves round', () => {
    const tax = computeGst({
      taxablePaise: 333,
      rateBps: 500,
      sellerState: '08',
      buyerState: '08',
    });
    expect(tax.cgstPaise + tax.sgstPaise).toBe(tax.taxPaise);
    expect(tax.totalPaise).toBe(333 + tax.taxPaise);
  });

  it('adds no tax at a zero rate', () => {
    const tax = computeGst({
      taxablePaise: 50_000,
      rateBps: 0,
      sellerState: '08',
      buyerState: '08',
    });
    expect(tax.taxPaise).toBe(0);
    expect(tax.totalPaise).toBe(50_000);
  });
});

describe('financialYear', () => {
  it('runs April to March in IST', () => {
    expect(financialYear(new Date('2026-04-01T00:00:00+05:30'))).toBe('2026-27');
    expect(financialYear(new Date('2027-03-31T23:59:00+05:30'))).toBe('2026-27');
    // 31 March 20:00 UTC is already 1 April in India.
    expect(financialYear(new Date('2027-03-31T20:00:00Z'))).toBe('2027-28');
  });
});

describe('formatInvoiceNumber', () => {
  it('stays within the 16-character GST limit', () => {
    const number = formatInvoiceNumber('INV', '2026-27', 123);
    expect(number).toBe('INV/2026-27/0123');
    expect(number.length).toBeLessThanOrEqual(16);
  });
});
