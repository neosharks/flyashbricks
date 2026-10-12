import { NextResponse } from 'next/server';
import { connectDb } from '@/lib/db';
import { isAuthorisedCron } from '@/lib/cron-auth';
import { logger, withTrace, reportUnexpected } from '@/lib/logger';
import { backoffDelayMs, MAX_OUTBOX_ATTEMPTS } from '@/lib/outbox';
import { handleOutboxTopic } from '@/features/notifications/deliver';
import { Outbox } from '@/models/outbox';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_SIZE = 25;

/**
 * How long a claimed message may stay `processing` before another run may take
 * it back. Comfortably longer than `maxDuration`, so a slow send is never
 * stolen from a run that is still going.
 */
const CLAIM_LEASE_MS = 5 * 60 * 1000;

/**
 * Drains the transactional outbox. Each message is claimed with an atomic
 * findOneAndUpdate, so two overlapping cron runs cannot send the same alert
 * twice. Failures back off and are retried until MAX_OUTBOX_ATTEMPTS.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorisedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withTrace(async () => {
    await connectDb();

    let processed = 0;
    let failed = 0;

    for (let index = 0; index < BATCH_SIZE; index += 1) {
      /*
       * Claims a pending message, or reclaims one left `processing` by a run
       * that died mid-send. Without the second branch a crashed handler strands
       * the row forever and the alert is never sent.
       */
      const message = await Outbox.findOneAndUpdate(
        {
          nextAttemptAt: { $lte: new Date() },
          $or: [
            { status: 'pending' },
            { status: 'processing', updatedAt: { $lte: new Date(Date.now() - CLAIM_LEASE_MS) } },
          ],
        },
        { $set: { status: 'processing' }, $inc: { attempts: 1 } },
        { sort: { nextAttemptAt: 1 }, returnDocument: 'after' },
      );

      if (!message) break;

      try {
        await handleOutboxTopic(message.topic, message.payload);
        await Outbox.updateOne({ _id: message._id }, { $set: { status: 'done', lastError: null } });
        processed += 1;
      } catch (err) {
        failed += 1;
        reportUnexpected(err, 'outbox message failed', {
          topic: message.topic,
          outbox_id: message._id.toString(),
        });

        const exhausted = message.attempts >= MAX_OUTBOX_ATTEMPTS;
        await Outbox.updateOne(
          { _id: message._id },
          {
            $set: {
              status: exhausted ? 'failed' : 'pending',
              nextAttemptAt: new Date(Date.now() + backoffDelayMs(message.attempts)),
              lastError: String(err).slice(0, 1000),
            },
          },
        );
      }
    }

    logger.info({ processed, failed }, 'outbox drained');
    return NextResponse.json({ processed, failed });
  });
}
