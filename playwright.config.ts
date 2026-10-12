import { defineConfig, devices } from '@playwright/test';

/** The port is configurable so the suite can run alongside whatever else is on 3000. */
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html'], ['github']] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Signs in once and saves the cookies the other projects reuse.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, dependencies: ['setup'] },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
  ],
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: `pnpm build && pnpm exec next start --port ${port}`,
          url: `${baseURL}/api/healthz`,
          // Never silently attach to whatever is already on this port.
          reuseExistingServer: false,
          timeout: 300_000,
        },
      }),
});
