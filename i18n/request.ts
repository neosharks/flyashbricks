import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE_NAME } from '@/lib/cookies';
import { DEFAULT_LOCALE, isLocale, type Locale } from './config';
import { loadMessages } from './messages';

/**
 * The language is a per-device preference held in a cookie rather than a URL
 * prefix: this is a signed-in tool, not a public site, so there is nothing to
 * index per language, and a link shared between a Hindi and an English user
 * should open in each reader's own language.
 */
async function resolveLocale(): Promise<Locale> {
  // The public landing pages are fixed to one language by their address;
  // proxy.ts sets this header for `/` and `/hi`.
  const forced = (await headers()).get('x-flyash-locale');
  if (isLocale(forced)) return forced;

  const saved = (await cookies()).get(LOCALE_COOKIE_NAME)?.value;
  if (isLocale(saved)) return saved;

  const accept = (await headers()).get('accept-language') ?? '';
  return /^hi\b/i.test(accept) ? 'hi' : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: 'Asia/Kolkata',
  };
});
