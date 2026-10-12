import { describe, expect, it } from 'vitest';
import { CreateCustomerSchema } from './schema';

const valid = {
  name: 'Ramesh Builders',
  phones: ['+91 98765 43210', ''],
  address: '',
  city: 'Jaipur',
  gstin: ' 27aapfu0939f1zv ',
  stateCode: '',
  notes: '',
};

describe('CreateCustomerSchema', () => {
  it('normalises phones, drops blank rows and uppercases the GSTIN', () => {
    const parsed = CreateCustomerSchema.parse(valid);
    expect(parsed.phones).toEqual(['9876543210']);
    expect(parsed.gstin).toBe('27AAPFU0939F1ZV');
    expect(parsed.stateCode).toBeNull();
    expect(parsed.address).toBeNull();
  });

  it('accepts a single phone sent as a plain string', () => {
    expect(CreateCustomerSchema.parse({ ...valid, phones: '9876543210' }).phones).toEqual([
      '9876543210',
    ]);
  });

  it('requires at least one phone number', () => {
    const result = CreateCustomerSchema.safeParse({ ...valid, phones: ['', ''] });
    expect(result.success).toBe(false);
  });

  it('flags the row that repeats a number', () => {
    const result = CreateCustomerSchema.safeParse({
      ...valid,
      phones: ['9876543210', '09876543210'],
    });
    expect(result.error?.issues[0]?.path).toEqual(['phones', 1]);
    expect(result.error?.issues[0]?.message).toBe('duplicatePhone');
  });

  it('keeps GST optional but rejects a GSTIN with a wrong check character', () => {
    expect(CreateCustomerSchema.parse({ ...valid, gstin: '' }).gstin).toBeNull();
    const typo = CreateCustomerSchema.safeParse({ ...valid, gstin: '27AAPFU0939F1ZW' });
    expect(typo.error?.issues[0]?.message).toBe('invalidGstin');
  });

  it('accepts a known GST state and rejects an unknown one', () => {
    expect(CreateCustomerSchema.parse({ ...valid, stateCode: '08' }).stateCode).toBe('08');
    expect(CreateCustomerSchema.safeParse({ ...valid, stateCode: '99' }).success).toBe(false);
  });

  it('rejects a malformed GSTIN and an invalid phone with translation keys', () => {
    const gst = CreateCustomerSchema.safeParse({ ...valid, gstin: '12345' });
    expect(gst.error?.issues[0]?.message).toBe('invalidGstin');
    const tel = CreateCustomerSchema.safeParse({ ...valid, phones: ['12345'] });
    expect(tel.error?.issues[0]?.message).toBe('invalidPhone');
  });

  it('rejects unknown fields and operator objects', () => {
    expect(CreateCustomerSchema.safeParse({ ...valid, duePaise: 0 }).success).toBe(false);
    expect(CreateCustomerSchema.safeParse({ ...valid, name: { $ne: null } }).success).toBe(false);
  });
});

describe('bilingual customer names', () => {
  it('fills the Hindi name, city and address from English', () => {
    const parsed = CreateCustomerSchema.parse({ ...valid, address: 'Ramesh Nagar' });
    expect(parsed.nameHi).toBe('रमेश बिल्डर्स');
    expect(parsed.cityHi).toBe('जयपुर');
    expect(parsed.addressHi).toBe('रमेश नगर');
  });

  it('fills English from a name typed only in Hindi', () => {
    const parsed = CreateCustomerSchema.parse({ ...valid, name: '', nameHi: 'रमेश' });
    expect(parsed.name).toBe('Ramesh');
    expect(parsed.nameHi).toBe('रमेश');
  });

  it('flags Hindi in the English box and English in the Hindi box, per box', () => {
    const result = CreateCustomerSchema.safeParse({ ...valid, name: 'रमेश', nameHi: 'Ramesh' });
    const issues = result.error?.issues.map((issue) => `${issue.path.join('.')}:${issue.message}`);
    expect(issues).toEqual(expect.arrayContaining(['name:mustBeEnglish', 'nameHi:mustBeHindi']));

    const city = CreateCustomerSchema.safeParse({ ...valid, cityHi: 'Jaipur' });
    expect(city.error?.issues[0]?.path).toEqual(['cityHi']);
  });

  it('still needs a name in at least one language', () => {
    const result = CreateCustomerSchema.safeParse({ ...valid, name: '', nameHi: '' });
    expect(result.error?.issues[0]?.path).toEqual(['name']);
  });
});
