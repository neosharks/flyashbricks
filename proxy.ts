import { NextResponse, type NextRequest } from 'next/server';

/** Coarse gating only — every page and action still checks the session itself. */
const PUBLIC_PATHS = [
  '/login',
  '/hi',
  '/robots.txt',
  '/sitemap.xml',
  '/opengraph-image',
  '/offline',
  '/api/auth',
  '/api/healthz',
  '/api/readyz',
  '/api/cron',
];

/** Both spellings: the `__Secure-` prefix depends on whether the app URL is https. */
const SESSION_COOKIES = ['__Secure-flyash.session', 'flyash.session'];

const isHttps = (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https://');

/**
 * One Content-Security-Policy for the whole app.
 *
 * Nonce-based would be stronger, but Next derives its nonce from a header on
 * the *request*, and rewriting request headers here drops `Set-Cookie` from the
 * handler underneath — which breaks sign-in. See docs/adr/0003-csp.md. There are
 * no third-party scripts at all, which is what keeps `'self'` meaningful.
 */
const CSP = [
  `default-src 'self'`,
  // React's development build reconstructs stack traces with eval(); production never does.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' blob: data:`,
  `font-src 'self' data:`,
  `connect-src 'self'`,
  `worker-src 'self'`,
  `manifest-src 'self'`,
  `object-src 'none'`,
  `base-uri 'none'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  ...(isHttps ? ['upgrade-insecure-requests'] : []),
].join('; ');

/** Header the i18n request config reads, so each public page has one fixed language. */
const LOCALE_HEADER = 'x-flyash-locale';

/** Public website pages besides the home page, each also under `/hi`. */
const SITE_PAGES = ['/features', '/security', '/contact'];

/**
 * The public website, the only thing search engines should index. The home
 * page is `/` (English, for visitors without a session) and `/hi` (Hindi, for
 * everyone); the other pages are `/features` and `/hi/features` and so on.
 * All are served from `/welcome/*`, which itself redirects to the public
 * address so the same page never exists at two addresses.
 */
function marketing(request: NextRequest, hasSession: boolean): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (pathname === '/welcome' || pathname.startsWith('/welcome/')) {
    const page = pathname.slice('/welcome'.length) || '/';
    return NextResponse.redirect(new URL(page, request.url), 308);
  }

  const hindi = pathname === '/hi' || pathname.startsWith('/hi/');
  const page = hindi ? pathname.slice('/hi'.length) || '/' : pathname;
  const isSitePage = SITE_PAGES.includes(page) || (page === '/' && (hindi || !hasSession));
  if (!isSitePage) return null;

  // Rewriting request headers is safe here: these pages set no cookies.
  // (See docs/adr/0003-csp.md for why that matters elsewhere.)
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, hindi ? 'hi' : 'en');
  const target = page === '/' ? '/welcome' : `/welcome${page}`;
  const response = NextResponse.rewrite(new URL(target, request.url), { request: { headers } });
  response.headers.set('Content-Security-Policy', CSP);
  return response;
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));

  const landing = marketing(request, hasSession);
  if (landing) return landing;

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (!isPublic && !hasSession) {
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', CSP);
  // Everything but the landing page is private; say so to every crawler,
  // including for responses that are not HTML pages.
  if (!['/robots.txt', '/sitemap.xml', '/opengraph-image'].includes(pathname)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

export const config = {
  // Static assets are excluded: running this on every asset is pure latency.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|robots.txt|.*\\.(?:svg|png|ico|webp)$).*)',
  ],
};
