import { NextResponse } from 'next/server';
import { isAuthorisedCron } from '@/lib/cron-auth';
import { reportUnexpected, withTrace } from '@/lib/logger';
import { removeOrphanAssets } from '@/features/assets/cleanup';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Daily housekeeping: uploaded files no record refers to any more. */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorisedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return withTrace(async () => {
    try {
      return NextResponse.json({ orphanedUploadsRemoved: await removeOrphanAssets() });
    } catch (err) {
      const traceId = reportUnexpected(err, 'cleanup failed');
      return NextResponse.json({ error: 'failed', traceId }, { status: 500 });
    }
  });
}
