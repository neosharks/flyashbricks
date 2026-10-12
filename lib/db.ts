import mongoose from '@/lib/mongoose';
import { env } from './env';

/**
 * One connection per process, cached on globalThis so Next's hot reload and
 * serverless invocation reuse do not open a new pool on every change.
 */
type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalCache = globalThis as typeof globalThis & { _mongoose?: Cache };
const cache: Cache = (globalCache._mongoose ??= { conn: null, promise: null });

export async function connectDb(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  cache.promise ??= mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 5_000,
    socketTimeoutMS: 20_000,
    retryWrites: true,
    writeConcern: { w: 'majority' },
    // Indexes are created by `pnpm db:migrate` as an explicit pipeline step.
    autoIndex: false,
  });

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}

export async function disconnectDb(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}
