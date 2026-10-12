import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Liveness. Deliberately checks no dependency: if Mongo is down the process is
 * still alive, and restarting it would make the outage worse, not better.
 */
export function GET(): NextResponse {
  return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
