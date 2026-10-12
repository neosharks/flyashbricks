/**
 * Expected failures cross the server/client boundary as values so the UI can
 * render them. Only genuinely unexpected failures throw.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: string;
      message: string;
      fields?: Record<string, string[]>;
      traceId?: string;
      retryAfter?: number;
    };

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(
  code: string,
  message: string,
  extra?: { fields?: Record<string, string[]>; traceId?: string; retryAfter?: number },
): ActionResult<never> {
  return { ok: false, code, message, ...extra };
}
