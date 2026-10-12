import 'server-only';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { AppError, RateLimitError, ValidationError } from './errors';
import { fail, type ActionResult } from './result';
import { reportUnexpected, withTrace } from './logger';
import { translateDynamic } from './i18n-dynamic';

/**
 * Wraps a Server Action body. Expected failures (`AppError`) come back as
 * values the UI can render; anything else is logged with a trace id and
 * replaced by a generic message, so Mongo errors and stack traces never reach
 * the browser.
 *
 * Failures carry stable codes and validation keys; this is also where they
 * are translated into the visitor's language, once, for every action.
 */
export async function runAction<T>(
  name: string,
  body: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const result = await withTrace(
    async (): Promise<ActionResult<T>> => {
      try {
        return await body();
      } catch (err) {
        // `redirect()` and `notFound()` signal control flow by throwing.
        if (isFrameworkControlFlow(err)) throw err;

        if (err instanceof RateLimitError) {
          return fail(err.code, err.message, { retryAfter: err.retryAfterSeconds });
        }
        // A validation failure found deep in a service still lands next to its field.
        if (err instanceof ValidationError) {
          return fail(err.code, err.message, err.fields ? { fields: err.fields } : undefined);
        }
        if (err instanceof AppError) return fail(err.code, err.message);

        const traceId = reportUnexpected(err, `action failed: ${name}`, { action: name });
        return fail('INTERNAL_ERROR', 'Something went wrong on our side. Please try again.', {
          traceId,
        });
      }
    },
    { traceId: randomUUID() },
  );

  return result.ok ? result : translateFailure(result);
}

async function translateFailure<T>(
  result: Extract<ActionResult<T>, { ok: false }>,
): Promise<ActionResult<T>> {
  const t = await getTranslations('errors');
  const tv = await getTranslations('validation');

  const message = translateDynamic(t, result.code, result.message, {
    seconds: result.retryAfter ?? 0,
  });

  const fields = result.fields
    ? Object.fromEntries(
        Object.entries(result.fields).map(([field, keys]) => [
          field,
          keys.map((key) => translateDynamic(tv, key, key)),
        ]),
      )
    : undefined;

  return { ...result, message, ...(fields ? { fields } : {}) };
}

function isFrameworkControlFlow(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND')
  );
}

/**
 * Turns a Zod issue into a translation key under `validation`. Schemas may set
 * a key as their message (`'passwordsDoNotMatch'`); anything else is keyed by
 * the kind of failure.
 */
export function issueKey(issue: z.core.$ZodIssue): string {
  if (/^[a-zA-Z]+$/.test(issue.message)) return issue.message;
  if (issue.code === 'too_small') {
    return issue.origin === 'string' && issue.minimum === 1 ? 'required' : 'tooSmall';
  }
  if (issue.code === 'too_big') return 'tooBig';
  if (issue.code === 'invalid_format') return 'invalidFormat';
  if (issue.code === 'invalid_type') {
    return issue.input === undefined || issue.input === '' ? 'required' : 'invalid';
  }
  return 'invalid';
}

/** Flattens a Zod error into the `fieldName -> keys` shape forms expect. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join('.') || '_form';
    (fields[path] ??= []).push(issueKey(issue));
  }
  return fields;
}

export function parseOrFail<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { ok: true; data: z.infer<S> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };

  return {
    ok: false,
    result: fail('VALIDATION_FAILED', 'Please check the highlighted fields.', {
      fields: fieldErrors(parsed.error),
    }),
  };
}

/**
 * `FormData` entries arrive as strings; this is the shape Zod schemas parse.
 *
 * React adds its own bookkeeping fields (`$ACTION_ID_…`, `$ACTION_REF_…`) to
 * every `useActionState` submission. They are stripped here, because the
 * schemas are `.strict()` and would otherwise reject every form in the app for
 * fields the user never filled in.
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const entries: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('$ACTION')) continue;
    if (value instanceof File) continue;
    const existing = entries[key];
    if (existing === undefined) {
      entries[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      entries[key] = [existing, value];
    }
  }
  return entries;
}
