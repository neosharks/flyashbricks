/** Application error taxonomy. `code` is stable and safe to show; `message` is not. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 500,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'You need to sign in to do that') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this') {
    super('FORBIDDEN', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super('VALIDATION_FAILED', message, 422);
  }
}

export class RateLimitError extends AppError {
  constructor(readonly retryAfterSeconds: number) {
    super('RATE_LIMITED', 'Too many requests. Please try again shortly.', 429);
  }
}

export function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
