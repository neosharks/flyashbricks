import type { z } from 'zod';

/**
 * How form input becomes field errors, shared by the server (`lib/action.ts`)
 * and the browser (`hooks/use-action-form.ts`). Keeping one copy means the
 * instant check in the form and the server's check agree key for key.
 */

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
