import { handlers } from '@/lib/auth';

export const { GET } = handlers;

/**
 * Sign-in goes only through the `signInWithCredentials` Server Action, which
 * applies the per-address and per-account attempt limits before calling
 * Auth.js in-process. Auth.js's own public credentials endpoint would let
 * anyone skip those limits, so it is closed; the rest of its POST routes
 * (sign-out, CSRF) are left to Auth.js.
 */
export function POST(request: Request): Promise<Response> | Response {
  if (new URL(request.url).pathname.startsWith('/api/auth/callback/credentials')) {
    return new Response(null, { status: 404 });
  }
  return handlers.POST(request as Parameters<typeof handlers.POST>[0]);
}
