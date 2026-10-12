/**
 * Accepts only a path inside this app, for redirects after sign-in and for
 * links stored in notifications. Browsers treat `\` like `/` and ignore tabs
 * and newlines, so `/\evil.com` and `/%09/evil.com` would both turn into
 * `//evil.com` — another website. Resolving against a fixed base and checking
 * the origin catches every such trick, not just the ones we thought of.
 */
const BASE = 'http://app.invalid';

export function safeAppPath(raw: unknown, fallback = '/'): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 500) return fallback;
  // Backslashes and control characters have no business in an app path.
  if (/[\\\u0000-\u001f\u007f]/.test(raw) || !raw.startsWith('/') || raw.startsWith('//')) {
    return fallback;
  }
  try {
    const url = new URL(raw, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function isSafeAppPath(raw: unknown): raw is string {
  return typeof raw === 'string' && raw.length > 0 && safeAppPath(raw, '') === raw;
}
