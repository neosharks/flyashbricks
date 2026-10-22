import { NO_ACCESS, type Permissions, type Role } from '@/lib/permissions';
import type { Gender } from '@/models/constants';

/**
 * The sign-ins `pnpm db:seed` creates, one per kind of access a factory hands
 * out. The login screen lists them when DEMO_LOGINS is on, so the password is
 * public by design: these accounts only ever see the synthetic demo company.
 *
 * The 99999 numbers keep clear of anyone a real company registers.
 */
export const DEMO_PASSWORD = 'demo-password-123';

export const DEMO_TIERS = ['owner', 'supervisor', 'sales', 'munshi', 'viewer'] as const;
export type DemoTier = (typeof DEMO_TIERS)[number];

export type DemoAccount = {
  tier: DemoTier;
  phone: string;
  name: string;
  nameHi: string;
  role: Role;
  permissions: Permissions;
  jobTitle: string;
  gender: Gender;
  email?: string;
};

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    tier: 'owner',
    phone: '9999900001',
    name: 'Vikram Singh',
    nameHi: 'विक्रम सिंह',
    role: 'admin',
    permissions: NO_ACCESS,
    jobTitle: 'Owner',
    gender: 'male',
    email: 'owner@example.com',
  },
  {
    tier: 'supervisor',
    phone: '9999900002',
    name: 'Rajesh Sharma',
    nameHi: 'राजेश शर्मा',
    role: 'employee',
    permissions: { ...NO_ACCESS, rawMaterials: 'write', production: 'write' },
    jobTitle: 'Plant supervisor',
    gender: 'male',
  },
  {
    tier: 'sales',
    phone: '9999900003',
    name: 'Pooja Saini',
    nameHi: 'पूजा सैनी',
    role: 'employee',
    permissions: { ...NO_ACCESS, sales: 'write', production: 'read' },
    jobTitle: 'Sales & accounts',
    gender: 'female',
  },
  {
    tier: 'munshi',
    phone: '9999900004',
    name: 'Harish Chand',
    nameHi: 'हरीश चंद',
    role: 'employee',
    permissions: { ...NO_ACCESS, staff: 'write', production: 'read' },
    jobTitle: 'Munshi (attendance & wages)',
    gender: 'male',
  },
  {
    tier: 'viewer',
    phone: '9999900005',
    name: 'Anita Agarwal',
    nameHi: 'अनीता अग्रवाल',
    role: 'employee',
    permissions: {
      rawMaterials: 'read',
      production: 'read',
      sales: 'read',
      staff: 'read',
      users: 'read',
    },
    jobTitle: 'Partner (view only)',
    gender: 'female',
  },
];

export function demoAccount(tier: DemoTier): DemoAccount {
  const account = DEMO_ACCOUNTS.find((candidate) => candidate.tier === tier);
  if (!account) throw new Error(`No demo account for ${tier}`);
  return account;
}
