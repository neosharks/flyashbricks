/**
 * Captures the product screenshots used on the public website, from a running
 * copy of the app signed in as the demo admin (seed data only).
 *
 * Usage: pnpm screenshots [base-url]   (default http://localhost:3000)
 *
 * Writes public/screenshots/<locale>/<name>-<mobile|desktop>[-dark].webp.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import sharp from 'sharp';
import { DEMO_PASSWORD, demoAccount } from '../features/auth/demo-accounts';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = path.join('public', 'screenshots');
const DEMO = { phone: demoAccount('owner').phone, password: DEMO_PASSWORD };

const DEVICES = {
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    width: 640,
  },
  desktop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
    isMobile: false,
    hasTouch: false,
    width: 1600,
  },
} as const;

type Shot = { name: string; path: (ids: Ids) => string; dark?: boolean };
type Ids = { sale: string; staff: string; customer: string; material: string };

const SHOTS: Shot[] = [
  { name: 'dashboard', path: () => '/', dark: true },
  { name: 'sales', path: () => '/sales' },
  { name: 'sale-new', path: () => '/sales/new' },
  { name: 'sale', path: (ids) => `/sales/${ids.sale}` },
  { name: 'invoice', path: (ids) => `/sales/${ids.sale}/invoice` },
  { name: 'customer', path: (ids) => `/customers/${ids.customer}` },
  { name: 'materials', path: () => '/raw-materials' },
  { name: 'material', path: (ids) => `/raw-materials/${ids.material}` },
  { name: 'production', path: () => '/production' },
  { name: 'stock', path: () => '/stock' },
  { name: 'attendance', path: () => '/staff/attendance' },
  { name: 'staff', path: (ids) => `/staff/${ids.staff}` },
  { name: 'notifications', path: () => '/notifications' },
  { name: 'users', path: () => '/users' },
];

/** Dev-only overlays and transient UI that should never appear in a product shot. */
const HIDE = `nextjs-portal, [data-nextjs-toast], [data-sonner-toaster] { display: none !important; }
*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }`;

async function firstId(
  page: Page,
  list: string,
  prefix: string,
  exclude: string[] = [],
): Promise<string> {
  await page.goto(`${BASE}${list}`, { waitUntil: 'networkidle' });
  const hrefs = await page
    .locator(`a[href^="${prefix}"]`)
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  const id = hrefs
    .map((href) => href.slice(prefix.length).split(/[/?#]/)[0] ?? '')
    .find((candidate) => /^[a-f0-9]{24}$/.test(candidate) && !exclude.includes(candidate));
  if (!id) throw new Error(`no ${prefix} link on ${list}`);
  return id;
}

async function signedInContext(
  browser: Browser,
  device: keyof typeof DEVICES,
  locale: string,
  dark: boolean,
) {
  const { width: _width, ...options } = DEVICES[device];
  const context = await browser.newContext({
    ...options,
    colorScheme: dark ? 'dark' : 'light',
    locale: 'en-IN',
  });
  const host = new URL(BASE).hostname;
  await context.addCookies([{ name: 'flyash.locale', value: locale, domain: host, path: '/' }]);
  await context.addInitScript(
    (theme) => {
      try {
        localStorage.setItem('flyash.theme', theme);
      } catch {
        // storage may be unavailable; the colour scheme still applies
      }
    },
    dark ? 'dark' : 'light',
  );

  // One sign-in for the whole run: the sign-in rate limit would stop a
  // fresh one per context.
  session ??= await signIn(context.newPage());
  await context.addCookies(session);
  return { context, page: await context.newPage() };
}

type Cookies = Awaited<ReturnType<BrowserContext['cookies']>>;
let session: Cookies | null = null;

async function signIn(opening: Promise<Page>): Promise<Cookies> {
  const page = await opening;
  await page.goto(`${BASE}/login`);
  await page.locator('input[name="identifier"]').fill(DEMO.phone);
  await page.locator('input[name="password"]').fill(DEMO.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });
  const cookies = (await page.context().cookies()).filter((cookie) =>
    cookie.name.includes('session'),
  );
  await page.close();
  return cookies;
}

async function capture(page: Page, url: string, file: string, width: number): Promise<void> {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: HIDE });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const png = await page.screenshot({ type: 'png' });
  await sharp(png).resize({ width }).webp({ quality: 78 }).toFile(file);
  console.log(`  ${file}`);
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  try {
    let ids: Ids | null = null;
    for (const locale of ['en', 'hi']) {
      await mkdir(path.join(OUT, locale), { recursive: true });
      for (const device of ['mobile', 'desktop'] as const) {
        for (const dark of [false, true]) {
          const shots = SHOTS.filter((shot) => !dark || shot.dark);
          const { context, page } = await signedInContext(browser, device, locale, dark);
          ids ??= {
            sale: await firstId(page, '/sales', '/sales/', ['new']),
            staff: await firstId(page, '/staff', '/staff/'),
            customer: await firstId(page, '/customers', '/customers/'),
            material: await firstId(page, '/raw-materials', '/raw-materials/'),
          };
          for (const shot of shots) {
            const suffix = dark ? '-dark' : '';
            const file = path.join(OUT, locale, `${shot.name}-${device}${suffix}.webp`);
            await capture(page, shot.path(ids), file, DEVICES[device].width);
          }
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
