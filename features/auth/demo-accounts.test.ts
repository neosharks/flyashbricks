import { describe, expect, it } from 'vitest';
import { normalizePhone } from '@/lib/phone';
import en from '@/messages/en/auth.json';
import { passwordSchema } from './schema';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DEMO_TIERS, demoAccount } from './demo-accounts';

describe('demo accounts', () => {
  it('has one sign-in per tier, with a phone the login accepts', () => {
    expect(DEMO_ACCOUNTS.map(({ tier }) => tier)).toEqual([...DEMO_TIERS]);
    for (const { phone } of DEMO_ACCOUNTS) expect(normalizePhone(phone)).toBe(phone);
    expect(new Set(DEMO_ACCOUNTS.map(({ phone }) => phone)).size).toBe(DEMO_ACCOUNTS.length);
  });

  it('keeps admin to the owner, so the other tiers show what an employee sees', () => {
    expect(DEMO_ACCOUNTS.filter(({ role }) => role === 'admin').map(({ tier }) => tier)).toEqual([
      'owner',
    ]);
    expect(Object.values(demoAccount('viewer').permissions)).not.toContain('write');
  });

  it('uses a password the password rules accept', () => {
    expect(passwordSchema.safeParse(DEMO_PASSWORD).success).toBe(true);
  });

  it('has a login-screen label for every tier', () => {
    for (const tier of DEMO_TIERS) {
      expect(en.demo.tiers[tier].name).toBeTruthy();
      expect(en.demo.tiers[tier].access).toBeTruthy();
    }
  });
});
