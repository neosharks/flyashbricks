import { expect, test } from '@playwright/test';
import { SUPERVISOR_STATE } from './helpers';

test.use({ storageState: SUPERVISOR_STATE });

test('an employee only sees the sections they were given', async ({ page, isMobile }) => {
  await page.goto('/');
  // The demo supervisor has raw materials + production, but no sales or employees.
  if (isMobile) await page.getByRole('button', { name: /more/i }).click();
  await expect(page.getByRole('link', { name: /raw materials/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /^employees$/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^sales$/i })).toHaveCount(0);
});

test('an employee cannot open a section by typing its address', async ({ page }) => {
  await page.goto('/users');
  await expect(page.getByText(/could not be loaded/i)).toBeVisible();
});
