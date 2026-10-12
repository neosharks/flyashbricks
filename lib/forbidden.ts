import { ForbiddenError } from './errors';

/**
 * Pages cannot return a 403 body directly in the App Router; throwing here hits
 * the segment's error boundary with a message that gives nothing away.
 */
export function forbidden(): never {
  throw new ForbiddenError();
}
