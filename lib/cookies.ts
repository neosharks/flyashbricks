import { publicEnv } from './public-env';

/**
 * Whether cookies get the `Secure` attribute and the `__Secure-` name prefix.
 *
 * Keyed on the configured app URL rather than NODE_ENV: a production build
 * served over plain HTTP (a local `pnpm start`, a box behind a proxy that
 * terminates TLS elsewhere) would otherwise set cookies the browser silently
 * drops, and every sign-in would appear to succeed and then vanish.
 */
export const useSecureCookies = publicEnv.APP_URL.startsWith('https://');

export const SESSION_COOKIE_NAME = `${useSecureCookies ? '__Secure-' : ''}flyash.session`;

/** Read by next-intl's request config; holds only `en` or `hi`. */
export const LOCALE_COOKIE_NAME = 'flyash.locale';

/**
 * The raw quick-sign-in token for this device; the server keeps only its hash.
 * Survives a normal sign-out, which is the point of it.
 */
export const DEVICE_COOKIE_NAME = `${useSecureCookies ? '__Secure-' : ''}flyash.device`;

export const DEVICE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: useSecureCookies,
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
} as const;

/** Set by a password sign-in so the dashboard can offer a PIN once; holds only `1`. */
export const PIN_OFFER_COOKIE_NAME = 'flyash.pin-offer';
