import { NextResponse } from 'next/server';
import { isAuthorisedCron } from '@/lib/cron-auth';
import { logger, reportUnexpected, withTrace } from '@/lib/logger';
import { sendOverdueReminders } from '@/features/notifications/reminders';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Daily reminders (overdue payments). Called by the scheduler once each morning. */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorisedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withTrace(async () => {
    try {
      const notified = await sendOverdueReminders();
      logger.info({ notified }, 'daily reminders sent');
      return NextResponse.json({ notified });
    } catch (err) {
      const traceId = reportUnexpected(err, 'daily reminders failed');
      return NextResponse.json({ error: 'failed', traceId }, { status: 500 });
    }
  });
}
