import { expect, test as setup } from '@playwright/test';
import { ADMIN_STATE, DEMO, signIn, SUPERVISOR_STATE } from './helpers';

setup('sign in as the demo admin', async ({ page }) => {
  await signIn(page, DEMO.admin.phone, DEMO.admin.password);
  await expect(page.getByRole('heading', { level: 1, name: /dashboard/i })).toBeVisible();
  await page.context().storageState({ path: ADMIN_STATE });
});

setup('sign in as the demo supervisor', async ({ page }) => {
  await signIn(page, DEMO.supervisor.phone, DEMO.supervisor.password);
  await expect(page.getByRole('heading', { level: 1, name: /dashboard/i })).toBeVisible();
  await page.context().storageState({ path: SUPERVISOR_STATE });
});
