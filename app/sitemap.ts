import type { MetadataRoute } from 'next';
import { SITE_PAGES, sitePath } from '@/components/marketing/site';
import { publicEnv } from '@/lib/public-env';

/** The public pages, each pointing at its other language as an alternate. */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => new URL(path, publicEnv.NEXT_PUBLIC_APP_URL).toString();
  return SITE_PAGES.flatMap((page) => {
    const languages = { 'en-IN': url(sitePath('en', page)), 'hi-IN': url(sitePath('hi', page)) };
    const priority = page === 'home' ? 1 : 0.8;
    return (['en', 'hi'] as const).map((locale) => ({
      url: url(sitePath(locale, page)),
      changeFrequency: 'monthly' as const,
      priority: locale === 'en' ? priority : priority - 0.1,
      alternates: { languages },
    }));
  });
}
