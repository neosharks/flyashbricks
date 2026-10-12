import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { publicEnv } from '@/lib/public-env';

/**
 * The public website: four pages, each at one English and one Hindi address.
 * proxy.ts serves them from `/welcome/*` with the language fixed per address.
 */
export const SITE_PAGES = ['home', 'features', 'security', 'contact'] as const;
export type SitePage = (typeof SITE_PAGES)[number];
export type SiteLocale = 'en' | 'hi';

const PATHS: Record<SitePage, string> = {
  home: '/',
  features: '/features',
  security: '/security',
  contact: '/contact',
};

export const CONTACT_EMAIL = 'admin@neosharks.in';
export const NEOSHARKS_CONTACT_URL = 'https://www.neosharks.in/contact';

export function sitePath(locale: SiteLocale, page: SitePage, hash = ''): string {
  const path = PATHS[page];
  const localized = locale === 'hi' ? (path === '/' ? '/hi' : `/hi${path}`) : path;
  return `${localized}${hash}`;
}

export function asSiteLocale(locale: string): SiteLocale {
  return locale === 'hi' ? 'hi' : 'en';
}

/** A product screenshot captured by `pnpm screenshots`, in the page's language. */
export function shot(
  locale: SiteLocale,
  name: string,
  device: 'mobile' | 'desktop',
  dark = false,
): { src: string; width: number; height: number } {
  return {
    src: `/screenshots/${locale}/${name}-${device}${dark ? '-dark' : ''}.webp`,
    ...(device === 'mobile' ? { width: 640, height: 1385 } : { width: 1600, height: 1000 }),
  };
}

export async function siteMetadata(locale: SiteLocale, page: SitePage): Promise<Metadata> {
  const t = await getTranslations('marketing');
  const title = t(`meta.${page}.title`);
  const description = t(`meta.${page}.description`);
  const path = sitePath(locale, page);
  return {
    title: { absolute: title },
    description,
    keywords: t('keywords'),
    alternates: {
      canonical: path,
      languages: {
        'en-IN': sitePath('en', page),
        'hi-IN': sitePath('hi', page),
        'x-default': sitePath('en', page),
      },
    },
    openGraph: {
      type: 'website',
      url: path,
      siteName: publicEnv.NEXT_PUBLIC_APP_NAME,
      title,
      description,
      locale: locale === 'hi' ? 'hi_IN' : 'en_IN',
      alternateLocale: locale === 'hi' ? ['en_IN'] : ['hi_IN'],
      // Set explicitly: page-level openGraph replaces the inherited image.
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  };
}
