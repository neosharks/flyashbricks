import { describe, expect, it } from 'vitest';
import { CreateUserSchema, foldPermissions } from './schema';

const valid = {
  name: 'Ramesh Kumar',
  phone: '+91 98765 43210',
  email: '',
  jobTitle: 'Supervisor',
  role: 'employee',
  gender: 'male',
  perm_rawMaterials: 'write',
  perm_production: 'read',
  perm_sales: 'none',
  perm_users: 'none',
};

describe('CreateUserSchema', () => {
  it('accepts a form submission and normalises it', () => {
    const parsed = CreateUserSchema.parse(foldPermissions(valid));
    expect(parsed.phone).toBe('9876543210');
    expect(parsed.email).toBeNull();
    expect(parsed.permissions).toEqual({
      rawMaterials: 'write',
      production: 'read',
      sales: 'none',
      staff: 'none',
      users: 'none',
    });
  });

  it('defaults an omitted module to no access', () => {
    const { perm_users: _omit, ...rest } = valid;
    expect(CreateUserSchema.parse(foldPermissions(rest)).permissions.users).toBe('none');
  });

  it('rejects an unknown access level or module', () => {
    expect(
      CreateUserSchema.safeParse(foldPermissions({ ...valid, perm_sales: 'owner' })).success,
    ).toBe(false);
    expect(
      CreateUserSchema.safeParse(foldPermissions({ ...valid, perm_billing: 'write' })).success,
    ).toBe(false);
  });

  it('rejects fields it does not know, so nothing can be mass-assigned', () => {
    expect(CreateUserSchema.safeParse(foldPermissions({ ...valid, orgId: 'x' })).success).toBe(
      false,
    );
    expect(
      CreateUserSchema.safeParse(foldPermissions({ ...valid, passwordHash: 'x' })).success,
    ).toBe(false);
  });

  it('rejects operator objects where text is expected', () => {
    expect(
      CreateUserSchema.safeParse(foldPermissions({ ...valid, phone: { $ne: null } })).success,
    ).toBe(false);
  });
});

describe('login names in two scripts', () => {
  it('fills the Hindi name from English', () => {
    expect(CreateUserSchema.parse(foldPermissions(valid)).nameHi).toBe('रमेश कुमार');
  });

  it('rejects English in the Hindi box', () => {
    const result = CreateUserSchema.safeParse(foldPermissions({ ...valid, nameHi: 'Ramesh' }));
    expect(result.error?.issues[0]).toMatchObject({ path: ['nameHi'], message: 'mustBeHindi' });
  });
});

describe('gender', () => {
  it('must be chosen for a new login', () => {
    const { gender: _gender, ...rest } = valid;
    expect(CreateUserSchema.safeParse(foldPermissions(rest)).error?.issues[0]).toMatchObject({
      path: ['gender'],
      message: 'chooseGender',
    });
    expect(
      CreateUserSchema.safeParse(foldPermissions({ ...valid, gender: 'unspecified' })).success,
    ).toBe(false);
  });
});
