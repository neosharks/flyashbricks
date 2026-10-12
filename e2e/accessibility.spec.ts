import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ADMIN_STATE } from './helpers';

const PAGES = [
  '/',
  '/raw-materials',
  '/production',
  '/stock',
  '/sales',
  '/sales/new',
  '/customers',
  '/users',
  '/activity',
  '/backup',
  '/account',
];

test.describe('signed-in pages', () => {
  test.use({ storageState: ADMIN_STATE });

  for (const path of PAGES) {
    test(`${path} has no accessibility violations`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('the whole app switches to Hindi', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('button', { name: /language/i })
      .first()
      .click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await expect(page.getByRole('heading', { level: 1, name: 'डैशबोर्ड' })).toBeVisible();
    await page.getByRole('button', { name: /भाषा/ }).first().click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test('the sign-in page has no accessibility violations', async ({ page }) => {
  await page.goto('/login');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
