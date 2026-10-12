import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { env } from './env';

type RequestContext = { traceId: string; userId?: string };

const store = new AsyncLocalStorage<RequestContext>();

/**
 * Fields scrubbed before anything reaches a log sink. Redaction lives here, not
 * at the call sites, so a new log line cannot forget it.
 */
const REDACT = [
  'password',
  'confirmPassword',
  'currentPassword',
  'newPassword',
  'temporaryPassword',
  'passwordHash',
  'token',
  'sessionToken',
  'authorization',
  'cookie',
  '*.password',
  '*.temporaryPassword',
  '*.passwordHash',
  '*.token',
  'req.headers.authorization',
  'req.headers.cookie',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT, censor: '[redacted]' },
  base: { service: 'fly-ash-bricks' },
  mixin: () => {
    const ctx = store.getStore();
    return ctx ? { trace_id: ctx.traceId, user_id: ctx.userId } : {};
  },
  ...(env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, singleLine: true } } }
    : {}),
});

export function withTrace<T>(fn: () => T, context?: Partial<RequestContext>): T {
  return store.run({ traceId: context?.traceId ?? randomUUID(), ...context }, fn);
}

export function currentTraceId(): string {
  return store.getStore()?.traceId ?? 'untraced';
}

/** Logs an unexpected error and returns the trace id to hand back to the user. */
export function reportUnexpected(
  err: unknown,
  message: string,
  extra?: Record<string, unknown>,
): string {
  const traceId = currentTraceId();
  logger.error({ err, trace_id: traceId, ...extra }, message);
  return traceId;
}
