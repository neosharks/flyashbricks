// @vitest-environment node
import { access } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';
import { asSiteLocale, shot, SITE_PAGES, sitePath } from './site';

describe('sitePath', () => {
  it('gives every page an English and a Hindi address', () => {
    expect(sitePath('en', 'home')).toBe('/');
    expect(sitePath('hi', 'home')).toBe('/hi');
    expect(sitePath('en', 'features')).toBe('/features');
    expect(sitePath('hi', 'contact')).toBe('/hi/contact');
    expect(sitePath('hi', 'home', '#faq')).toBe('/hi#faq');
  });

  it('treats anything but Hindi as English', () => {
    expect(asSiteLocale('hi')).toBe('hi');
    expect(asSiteLocale('fr')).toBe('en');
  });
});

describe('sitemap', () => {
  it('lists each page in both languages, with the other as its alternate', () => {
    const entries = sitemap();
    expect(entries).toHaveLength(SITE_PAGES.length * 2);
    const features = entries.find((entry) => entry.url.endsWith('/hi/features'));
    expect(features?.alternates?.languages).toMatchObject({
      'en-IN': expect.stringMatching(/\/features$/) as unknown,
    });
  });
});

describe('screenshots', () => {
  it('exist for the pictures the website shows', async () => {
    const used = [
      ...['dashboard', 'sales', 'materials', 'production', 'attendance', 'invoice'].flatMap(
        (name) => [shot('en', name, 'mobile'), shot('en', name, 'desktop')],
      ),
      shot('en', 'dashboard', 'mobile', true),
      shot('hi', 'sale-new', 'mobile'),
    ];
    for (const { src } of used) {
      await expect(access(path.join('public', src))).resolves.toBeUndefined();
    }
  });
});
