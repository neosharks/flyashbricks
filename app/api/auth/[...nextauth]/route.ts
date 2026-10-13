import { handlers } from '@/lib/auth';

export const { GET } = handlers;

/**
 * Sign-in goes only through the `signInWithCredentials` and `signInWithPin`
 * Server Actions, which apply the per-address, per-account and per-device
 * attempt limits before calling Auth.js in-process. Auth.js's own public
 * callback endpoints would let anyone skip those limits, so they are closed;
 * the rest of its POST routes (sign-out, CSRF) are left to Auth.js.
 */
const CLOSED_CALLBACKS = ['/api/auth/callback/credentials', '/api/auth/callback/pin'];

export function POST(request: Request): Promise<Response> | Response {
  const { pathname } = new URL(request.url);
  if (CLOSED_CALLBACKS.some((path) => pathname.startsWith(path))) {
    return new Response(null, { status: 404 });
  }
  return handlers.POST(request as Parameters<typeof handlers.POST>[0]);
}
