import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { latestNotifications, unreadCount } from '@/features/notifications/queries';
import { reportUnexpected, withTrace } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * What the bell needs: the unread count, and — when asked — the latest few
 * notifications already rendered in the viewer's language. Polled by the
 * open app, so it is a cheap indexed count unless the dropdown is open.
 */
export async function GET(request: Request): Promise<NextResponse> {
  return withTrace(async () => {
    const user = await getSessionUser();
    if (!user || user.mustChangePassword) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }

    try {
      const withItems = new URL(request.url).searchParams.get('items') === '1';
      const [unread, items] = await Promise.all([
        unreadCount(user),
        withItems ? latestNotifications(user, 8) : Promise.resolve(null),
      ]);
      return NextResponse.json({ unread, items }, { headers: NO_STORE });
    } catch (err) {
      const traceId = reportUnexpected(err, 'notification summary failed');
      return NextResponse.json({ error: 'failed', traceId }, { status: 500, headers: NO_STORE });
    }
  });
}
