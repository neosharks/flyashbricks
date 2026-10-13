import type { Page } from '@playwright/test';

/** Accounts created by `pnpm db:seed` (demo data only — the seed refuses production). */
export const DEMO = {
  admin: { phone: '9000000001', password: 'demo-password-123' },
  supervisor: { phone: '9000000002', password: 'demo-password-123' },
} as const;

export const ADMIN_STATE = '.playwright/admin.json';
export const SUPERVISOR_STATE = '.playwright/supervisor.json';

let visitor = 0;

/**
 * Each sign-in comes from its own address (TEST-NET-2), as separate people
 * would; otherwise the whole suite shares one per-address sign-in limit.
 */
export async function signIn(page: Page, phone: string, password: string): Promise<void> {
  visitor += 1;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `198.51.100.${visitor}` });
  await page.goto('/login');
  await page.getByLabel(/phone number or email/i).fill(phone);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
}
