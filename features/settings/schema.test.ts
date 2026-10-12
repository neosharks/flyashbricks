import { describe, expect, it } from 'vitest';
import { BusinessSettingsSchema } from './schema';

const base = {
  name: 'Shree Bricks',
  legalName: '',
  address: 'NH 48',
  city: 'Jaipur',
  pincode: '302001',
  stateCode: '08',
  phone: '',
  email: '',
  gstin: '',
  gstRateBps: '500',
  hsnCode: '6815',
  invoicePrefix: 'inv',
  bankAccountName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  bankName: '',
  upiId: '',
  invoiceTerms: '',
};

describe('BusinessSettingsSchema', () => {
  it('needs nothing GST-related from a business without GST', () => {
    const parsed = BusinessSettingsSchema.parse(base);
    expect(parsed.gstin).toBeNull();
    expect(parsed.gstRateBps).toBe(0);
    expect(parsed.invoicePrefix).toBe('INV');
    expect(parsed.bank).toEqual({
      accountName: null,
      accountNumber: null,
      ifsc: null,
      bankName: null,
    });
  });

  it('requires a valid GSTIN once GST is switched on, and takes the state from it', () => {
    expect(BusinessSettingsSchema.safeParse({ ...base, gstRegistered: 'on' }).success).toBe(false);
    expect(
      BusinessSettingsSchema.safeParse({ ...base, gstRegistered: 'on', gstin: '27AAPFU0939F1ZW' })
        .success,
    ).toBe(false);

    const parsed = BusinessSettingsSchema.parse({
      ...base,
      gstRegistered: 'on',
      gstin: '27aapfu0939f1zv',
    });
    expect(parsed.gstin).toBe('27AAPFU0939F1ZV');
    expect(parsed.gstRateBps).toBe(500);
    expect(parsed.stateCode).toBe('27');
  });

  it('rejects malformed bank and UPI details but allows them blank', () => {
    expect(BusinessSettingsSchema.safeParse({ ...base, bankIfsc: 'SBIN123' }).success).toBe(false);
    expect(BusinessSettingsSchema.safeParse({ ...base, upiId: 'not a upi' }).success).toBe(false);
    expect(
      BusinessSettingsSchema.parse({ ...base, bankIfsc: 'sbin0001234', upiId: 'shree@okaxis' }).bank
        .ifsc,
    ).toBe('SBIN0001234');
  });

  it('only accepts real GST rates', () => {
    expect(BusinessSettingsSchema.safeParse({ ...base, gstRateBps: '700' }).success).toBe(false);
  });
});

describe('business details in two scripts', () => {
  it('fills the Hindi business name and address for the invoice', () => {
    const parsed = BusinessSettingsSchema.parse({
      ...base,
      name: 'Shree Ganesh',
      address: 'Ramesh Nagar',
    });
    expect(parsed.nameHi).toBe('श्री गणेश');
    expect(parsed.addressHi).toBe('रमेश नगर');
    expect(parsed.legalNameHi).toBeNull();
  });

  it('rejects Hindi in the English name box', () => {
    const result = BusinessSettingsSchema.safeParse({ ...base, name: 'श्री ब्रिक्स', nameHi: '' });
    expect(result.error?.issues[0]).toMatchObject({ path: ['name'], message: 'mustBeEnglish' });
  });
});
