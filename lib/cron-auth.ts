import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { env } from './env';

/**
 * Scheduled endpoints are reachable from the internet, so they carry a shared
 * secret. Compared in constant time so the header cannot be guessed byte by byte.
 */
export function isAuthorisedCron(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${env.CRON_SECRET}`;

  const a = Buffer.from(header, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
