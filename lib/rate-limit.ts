import 'server-only';
import { randomUUID } from 'node:crypto';
import { getRedis } from './redis';
import { logger } from './logger';

export type RateLimitResult = { success: boolean; remaining: number; resetSeconds: number };

/**
 * Sliding-window counter. The Lua script keeps read-modify-write atomic so
 * concurrent replicas cannot both see "one request left".
 *
 * The sorted-set member is generated in Node, not in Lua: Redis re-seeds the
 * Lua PRNG before every script run, so `math.random()` returns the same value
 * every time. Two requests in the same millisecond would then write the same
 * member, overwrite each other, and count as one — which is exactly the burst
 * a login limiter exists to stop.
 */
const SLIDING_WINDOW = `
local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local used = redis.call('ZCARD', key)
if used >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local reset = window - (now - tonumber(oldest[2]))
  return { 0, 0, reset }
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return { 1, limit - used - 1, window }
`;

/**
 * Used when REDIS_URL is unset: enough for a single server, which is how this
 * app is deployed. Counts reset when the app restarts, and do not hold across
 * replicas — set REDIS_URL if it ever runs as more than one process.
 */
const memory = new Map<string, number[]>();

/** Above this many tracked keys, forget the ones with no hit inside any window. */
const SWEEP_AT = 5_000;

function sweep(now: number): void {
  const longest = Math.max(...Object.values(RATE_LIMITS).map((rule) => rule.windowMs));
  for (const [key, hits] of memory) {
    if ((hits.at(-1) ?? 0) <= now - longest) memory.delete(key);
  }
}

function limitInMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (memory.size > SWEEP_AT) sweep(now);
  const hits = (memory.get(key) ?? []).filter((t) => t > now - windowMs);

  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    return {
      success: false,
      remaining: 0,
      resetSeconds: Math.ceil((windowMs - (now - oldest)) / 1000),
    };
  }

  hits.push(now);
  memory.set(key, hits);
  return {
    success: true,
    remaining: limit - hits.length,
    resetSeconds: Math.ceil(windowMs / 1000),
  };
}

export type RateLimitRule = { limit: number; windowMs: number };

/** Named budgets, so a limit is chosen deliberately rather than invented per call site. */
export const RATE_LIMITS = {
  login: { limit: 5, windowMs: 60_000 },
  /** Behind `login`, at the password check itself; looser so it never trips first for real users. */
  loginBackend: { limit: 10, windowMs: 60_000 },
  passwordChange: { limit: 5, windowMs: 900_000 },
  userAdmin: { limit: 30, windowMs: 300_000 },
  write: { limit: 120, windowMs: 60_000 },
  export: { limit: 10, windowMs: 60_000 },
  upload: { limit: 20, windowMs: 600_000 },
} as const satisfies Record<string, RateLimitRule>;

export async function rateLimit(
  bucket: keyof typeof RATE_LIMITS,
  identifier: string,
): Promise<RateLimitResult> {
  const { limit, windowMs } = RATE_LIMITS[bucket];
  const key = `rl:${bucket}:${identifier}`;
  const redis = getRedis();

  if (!redis) return limitInMemory(key, limit, windowMs);

  try {
    const [allowed, remaining, reset] = (await redis.eval(
      SLIDING_WINDOW,
      1,
      key,
      Date.now(),
      windowMs,
      limit,
      randomUUID(),
    )) as [number, number, number];

    return { success: allowed === 1, remaining, resetSeconds: Math.ceil(reset / 1000) };
  } catch (err) {
    // A rate limiter that is down must not take the whole endpoint with it, but
    // it must also not silently disappear.
    logger.error({ err, bucket }, 'rate limiter unavailable, falling back to in-process counter');
    return limitInMemory(key, limit, windowMs);
  }
}
