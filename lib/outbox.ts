import 'server-only';
import type { ClientSession } from '@/lib/mongoose';
import { Outbox } from '@/models/outbox';
import type { OutboxTopic } from '@/models/constants';

/**
 * Enqueues a side effect in the same transaction as the business write.
 * Nothing is sent inline, so a slow mail server cannot slow down a stock update and a
 * crash after the write cannot lose the notification.
 */
export async function enqueue(
  topic: OutboxTopic,
  payload: Record<string, unknown>,
  session?: ClientSession,
): Promise<void> {
  await Outbox.create(
    [{ topic, payload, status: 'pending', attempts: 0, nextAttemptAt: new Date() }],
    session ? { session } : {},
  );
}

/** Exponential backoff with a 1 hour ceiling. */
export function backoffDelayMs(attempts: number): number {
  return Math.min(60 * 60 * 1000, 2 ** attempts * 30_000);
}

export const MAX_OUTBOX_ATTEMPTS = 8;
