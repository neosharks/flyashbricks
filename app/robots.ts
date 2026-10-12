import type { MetadataRoute } from 'next';
import { SITE_PAGES, sitePath } from '@/components/marketing/site';
import { publicEnv } from '@/lib/public-env';

/**
 * Only the public website is for search engines, along with the assets needed
 * to render it. Everything else is a private business tool behind sign-in; it
 * also sends `X-Robots-Tag: noindex`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          ...SITE_PAGES.flatMap((page) => [`${sitePath('en', page)}$`, `${sitePath('hi', page)}$`]),
          '/opengraph-image',
          '/screenshots/',
          '/_next/static/',
          '/_next/image',
        ],
        disallow: ['/'],
      },
    ],
    sitemap: new URL('/sitemap.xml', publicEnv.NEXT_PUBLIC_APP_URL).toString(),
    host: publicEnv.NEXT_PUBLIC_APP_URL,
  };
}
