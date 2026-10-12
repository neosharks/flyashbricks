import 'server-only';
import mongoose, { type ClientSession } from '@/lib/mongoose';

/**
 * Runs `fn` in a MongoDB transaction, retrying transient errors (the driver's
 * `withTransaction` does that). Keep the body short and free of network calls
 * other than to the database.
 */
export async function inTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}
