import { expect, test } from '@playwright/test';
import { DEMO, signIn } from './helpers';

test.describe('signing in', () => {
  test('sends a visitor without a session to the sign-in page', async ({ page }) => {
    await page.goto('/sales');
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fsales/);
  });

  test('gives the same answer for a wrong password and an unknown account', async ({ page }) => {
    await signIn(page, DEMO.admin.phone, 'not-the-password');
    const wrongPassword = await page.getByRole('alert').textContent();

    await signIn(page, '9123456789', 'not-the-password');
    await expect(page.getByRole('alert')).toHaveText(wrongPassword ?? '');
  });
});

test.describe('a new employee', () => {
  test('must replace the temporary password before using the app', async ({ page, browser }) => {
    // The admin creates the account and reads the temporary password off the dialog.
    const admin = await browser.newContext({ storageState: '.playwright/admin.json' });
    const adminPage = await admin.newPage();
    await adminPage.goto('/users/new');
    const phone = `8${String(Date.now()).slice(-9)}`;
    await adminPage.getByLabel(/full name — english/i).fill('E2E Worker');
    await adminPage.getByLabel(/mobile number/i).fill(phone);
    await adminPage.getByText('Male', { exact: true }).click();
    await adminPage.getByRole('button', { name: /create employee/i }).click();
    const temporary = (await adminPage.locator('code').textContent())?.trim() ?? '';
    expect(temporary).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    await admin.close();

    await signIn(page, phone, temporary);
    await expect(page).toHaveURL(/\/set-password/);

    // Any other page bounces back until a real password is set.
    await page.goto('/sales');
    await expect(page).toHaveURL(/\/set-password/);

    await page.getByLabel(/temporary password/i).fill(temporary);
    await page.getByLabel(/^new password/i).fill('a long new password');
    await page.getByLabel(/confirm new password/i).fill('a long new password');
    await page.getByRole('button', { name: /set password/i }).click();
    await expect(page.getByRole('heading', { level: 1, name: /dashboard/i })).toBeVisible();
  });
});
