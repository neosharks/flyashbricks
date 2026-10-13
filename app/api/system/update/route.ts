import { env } from '@/lib/env';
import { can } from '@/lib/permissions';
import { getSessionUser } from '@/lib/session';
import { readUpdaterState } from '@/features/system/updater';

export const dynamic = 'force-dynamic';

/**
 * Progress of an update, polled by the Updates page. A route rather than a
 * Server Action: the app restarts during an update, and a new build no longer
 * recognises the old page's action ids, while a plain URL keeps working.
 */
export async function GET(): Promise<Response> {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) return new Response(null, { status: 401 });
  if (!can(user, 'system:update')) return new Response(null, { status: 403 });

  const state = await readUpdaterState(env.UPDATER_DIR);
  return Response.json(
    { current: env.APP_VERSION, ...state },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
