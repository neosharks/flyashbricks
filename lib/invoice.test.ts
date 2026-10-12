import { describe, expect, it } from 'vitest';
import { Types } from '@/lib/mongoose';
import type { OrganizationDoc } from '@/models/organization';
import { invoiceKind, invoiceSequence, saleTax, sellerSnapshot } from './invoice';

const org = (overrides: Partial<OrganizationDoc> = {}): OrganizationDoc => ({
  _id: new Types.ObjectId(),
  name: 'Shree Bricks',
  nameHi: 'श्री ब्रिक्स',
  legalName: null,
  legalNameHi: null,
  address: 'NH 48, Industrial Area',
  addressHi: null,
  city: 'Jaipur',
  pincode: '302001',
  stateCode: '08',
  phone: '9876543210',
  email: null,
  gstin: null,
  gstRateBps: 500,
  hsnCode: '6815',
  invoicePrefix: 'INV',
  bank: { accountName: null, accountNumber: null, ifsc: null, bankName: null },
  upiId: null,
  invoiceTerms: null,
  timezone: 'Asia/Kolkata',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const buyer = {
  name: 'Ramesh',
  nameHi: 'रमेश',
  phone: '9123456789',
  address: null,
  addressHi: null,
  gstin: null,
  stateCode: null,
};

describe('sellerSnapshot', () => {
  it('joins the address and prefers the legal name', () => {
    const seller = sellerSnapshot(org({ legalName: 'Shree Bricks Pvt Ltd' }));
    expect(seller.name).toBe('Shree Bricks Pvt Ltd');
    expect(seller.address).toBe('NH 48, Industrial Area, Jaipur, 302001');
  });

  it('carries the Hindi name of whichever name is printed', () => {
    expect(sellerSnapshot(org()).nameHi).toBe('श्री ब्रिक्स');
    const legal = sellerSnapshot(
      org({ legalName: 'Shree Bricks Pvt Ltd', legalNameHi: 'श्री ब्रिक्स प्रा. लि.' }),
    );
    expect(legal.nameHi).toBe('श्री ब्रिक्स प्रा. लि.');
  });
});

describe('saleTax', () => {
  it('charges nothing when the seller has no GSTIN, whatever the rate', () => {
    const seller = sellerSnapshot(org({ gstin: null, gstRateBps: 1200 }));
    expect(saleTax(seller, buyer, 100_000, 1200).taxPaise).toBe(0);
    expect(invoiceKind(seller)).toBe('invoice');
  });

  it('charges CGST + SGST for a local buyer', () => {
    const seller = sellerSnapshot(org({ gstin: '08AAPFU0939F1Z1' }));
    const tax = saleTax(seller, buyer, 100_000, 500);
    expect(tax.cgstPaise).toBe(2_500);
    expect(tax.sgstPaise).toBe(2_500);
    expect(invoiceKind(seller)).toBe('tax_invoice');
  });

  it('charges IGST when the buyer GSTIN is from another state', () => {
    const seller = sellerSnapshot(org({ gstin: '08AAPFU0939F1Z1' }));
    const tax = saleTax(seller, { ...buyer, gstin: '09AAPFU0939F1Z1' }, 100_000, 500);
    expect(tax.igstPaise).toBe(5_000);
  });
});

describe('invoiceSequence', () => {
  it('numbers invoices per financial year', () => {
    const sequence = invoiceSequence('INV', new Date('2026-10-12T10:00:00+05:30'));
    expect(sequence.counter).toBe('invoice:2026-27');
    expect(sequence.format(9)).toBe('INV/2026-27/0009');
  });
});
