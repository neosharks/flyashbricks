import 'server-only';
import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

const globalCache = globalThis as typeof globalThis & { _redis?: Redis | null };

/** Returns null when Redis is not configured (development only — see lib/env.ts). */
export function getRedis(): Redis | null {
  if (globalCache._redis !== undefined) return globalCache._redis;

  if (!env.REDIS_URL) {
    globalCache._redis = null;
    return null;
  }

  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    connectTimeout: 3_000,
    lazyConnect: false,
    // Queue commands issued before the socket is ready rather than failing them:
    // otherwise the first request after a cold start always falls back.
    enableOfflineQueue: true,
  });

  client.on('error', (err: unknown) => {
    logger.error({ err }, 'redis connection error');
  });

  globalCache._redis = client;
  return client;
}
