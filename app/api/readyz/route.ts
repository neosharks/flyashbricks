import { NextResponse } from 'next/server';
import mongoose from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** Readiness: can this replica actually serve traffic right now? */
export async function GET(): Promise<NextResponse> {
  try {
    await connectDb();
    await mongoose.connection.db?.admin().command({ ping: 1 });

    return NextResponse.json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    logger.error({ err }, 'readiness check failed');
    return NextResponse.json(
      { status: 'not-ready' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
