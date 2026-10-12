// @vitest-environment node
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

/** The page file a URL path is served from, ignoring route groups such as `(app)`. */
async function pageExists(urlPath: string): Promise<boolean> {
  const segments = (urlPath.split('?')[0] ?? '').split('/').filter(Boolean);
  for (const group of ['', '(app)', '(auth)', '(marketing)']) {
    try {
      await access(path.join('app', group, ...segments, 'page.tsx'));
      return true;
    } catch {
      // try the next route group
    }
  }
  return false;
}

describe('web app manifest', () => {
  const app = manifest();

  it('opens the installed app on sign-in, not the public landing page', () => {
    expect(app.start_url).toBe('/login');
    expect(app.display).toBe('standalone');
  });

  it('points every home-screen shortcut at a real page', async () => {
    for (const shortcut of app.shortcuts ?? []) {
      expect(await pageExists(shortcut.url), shortcut.url).toBe(true);
    }
  });

  it('ships a maskable icon and the 192 and 512 sizes installers require', () => {
    const icons = app.icons ?? [];
    expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
    for (const size of ['192x192', '512x512']) {
      expect(icons.some((icon) => icon.sizes === size)).toBe(true);
    }
  });
});

describe('service worker', () => {
  it('never caches pages or data, only build assets and the offline page', async () => {
    const source = await readFile('public/sw.js', 'utf8');
    // Only one cache.put, and it sits behind the /_next/static/ check.
    expect(source.match(/cache\.put\(/g)).toHaveLength(1);
    expect(source.indexOf("startsWith('/_next/static/')")).toBeLessThan(
      source.indexOf('cache.put('),
    );
    expect(await pageExists('/offline')).toBe(true);
  });
});
