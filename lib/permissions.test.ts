import { describe, expect, it } from 'vitest';
import {
  can,
  canGrant,
  canManageUser,
  NO_ACCESS,
  type Action,
  type SessionUser,
} from './permissions';

const admin: SessionUser = {
  id: 'a1',
  orgId: 'org1',
  name: 'Owner',
  role: 'admin',
  permissions: NO_ACCESS,
  mustChangePassword: false,
};

const salesClerk: SessionUser = {
  id: 'e1',
  orgId: 'org1',
  name: 'Clerk',
  role: 'employee',
  permissions: { ...NO_ACCESS, sales: 'write', production: 'read' },
  mustChangePassword: false,
};

const manager: SessionUser = {
  ...salesClerk,
  id: 'e2',
  permissions: {
    rawMaterials: 'write',
    production: 'write',
    sales: 'read',
    staff: 'read',
    users: 'write',
  },
};

describe('can', () => {
  it('denies an unknown action for everyone, including an admin', () => {
    expect(can(admin, 'nonsense' as Action)).toBe(false);
    expect(can(salesClerk, 'nonsense' as Action)).toBe(false);
  });

  it('lets an admin do everything in their own organisation', () => {
    expect(can(admin, 'rawMaterials:write')).toBe(true);
    expect(can(admin, 'sales:void')).toBe(true);
    expect(can(admin, 'activity:read')).toBe(true);
  });

  it('refuses any resource from another organisation, even for an admin', () => {
    expect(can(admin, 'sales:read', { orgId: 'org2' })).toBe(false);
    expect(can(salesClerk, 'sales:write', { orgId: 'org2' })).toBe(false);
    expect(can(salesClerk, 'sales:write', { orgId: 'org1' })).toBe(true);
  });

  it('treats write access as including read', () => {
    expect(can(salesClerk, 'sales:read')).toBe(true);
    expect(can(salesClerk, 'sales:write')).toBe(true);
  });

  it('keeps read-only access read-only', () => {
    expect(can(salesClerk, 'production:read')).toBe(true);
    expect(can(salesClerk, 'production:write')).toBe(false);
  });

  it('keeps attendance and wages behind the staff section', () => {
    expect(can(salesClerk, 'staff:read')).toBe(false);
    expect(can(manager, 'staff:read')).toBe(true);
    expect(can(manager, 'staff:write')).toBe(false);
    expect(can(admin, 'staff:write')).toBe(true);
  });

  it('gives no access to a module set to none', () => {
    expect(can(salesClerk, 'rawMaterials:read')).toBe(false);
    expect(can(salesClerk, 'users:read')).toBe(false);
  });

  it('keeps voiding sales, the activity log, backups and updates for admins', () => {
    expect(can(salesClerk, 'sales:void')).toBe(false);
    expect(can(manager, 'activity:read')).toBe(false);
    expect(can(manager, 'backup:run')).toBe(false);
    expect(can(admin, 'backup:run')).toBe(true);
    expect(can(manager, 'settings:manage')).toBe(false);
    expect(can(admin, 'settings:manage')).toBe(true);
    expect(can(manager, 'system:update')).toBe(false);
    expect(can(admin, 'system:update')).toBe(true);
  });

  it('stops an employee user-manager from touching an admin account', () => {
    expect(can(manager, 'users:write', { targetRole: 'employee' })).toBe(true);
    expect(can(manager, 'users:write', { targetRole: 'admin' })).toBe(false);
    expect(can(admin, 'users:write', { targetRole: 'admin' })).toBe(true);
  });
});

describe('canGrant', () => {
  it('lets an admin grant anything', () => {
    expect(canGrant(admin, 'admin', NO_ACCESS)).toBe(true);
  });

  it('never lets an employee create an admin', () => {
    expect(canGrant(manager, 'admin', NO_ACCESS)).toBe(false);
  });

  it('lets an employee grant at most the access they hold', () => {
    expect(canGrant(manager, 'employee', { ...NO_ACCESS, rawMaterials: 'write' })).toBe(true);
    expect(canGrant(manager, 'employee', { ...NO_ACCESS, sales: 'read' })).toBe(true);
    expect(canGrant(manager, 'employee', { ...NO_ACCESS, sales: 'write' })).toBe(false);
  });
});

describe('canManageUser', () => {
  const org = 'org1';

  it('lets an admin manage anyone in the organisation', () => {
    expect(canManageUser(admin, { orgId: org, role: 'admin', permissions: NO_ACCESS })).toBe(true);
    expect(
      canManageUser(admin, {
        orgId: org,
        role: 'employee',
        permissions: { ...NO_ACCESS, sales: 'write', staff: 'write' },
      }),
    ).toBe(true);
  });

  it('stops an employee from managing someone with more access than they have', () => {
    // The manager has sales: read; the clerk has sales: write.
    expect(
      canManageUser(manager, { orgId: org, role: 'employee', permissions: salesClerk.permissions }),
    ).toBe(false);
  });

  it('lets an employee manage someone whose access is within their own', () => {
    expect(
      canManageUser(manager, {
        orgId: org,
        role: 'employee',
        permissions: { ...NO_ACCESS, rawMaterials: 'read', production: 'write' },
      }),
    ).toBe(true);
  });

  it('never lets an employee manage an admin or another organisation', () => {
    expect(canManageUser(manager, { orgId: org, role: 'admin', permissions: NO_ACCESS })).toBe(
      false,
    );
    expect(canManageUser(admin, { orgId: 'org2', role: 'employee', permissions: NO_ACCESS })).toBe(
      false,
    );
  });
});
