'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { z } from 'zod';
import { describeFields, keysOf, revealFirstError } from '@/lib/form-fields';
import { translateDynamic } from '@/lib/i18n-dynamic';
import type { ActionResult } from '@/lib/result';
import { fieldErrors, formDataToObject } from '@/lib/validation';

type FormAction<T> = (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;

type Options = {
  /**
   * The schema the action parses, checked in the browser before anything is
   * sent. Only for schemas that are safe to bundle for the browser; the server
   * checks again either way.
   */
  schema?: z.ZodType;
  /** Reshapes the posted fields exactly as the action does before parsing (`foldLines`, …). */
  prepare?: (raw: Record<string, unknown>) => Record<string, unknown>;
  /** Translates the keys a feature keeps in its own namespace; shared keys arrive translated. */
  translate?: (message: string) => string;
  /** Called with the failing fields, e.g. to open the section that holds them. */
  onInvalid?: (fields: string[]) => void;
};

export type FieldErrorItem = {
  field: string;
  message: string;
  /** Present when the form has a control for this field to jump to. */
  target: { label: string | null } | null;
};

const NOTHING: ReadonlySet<string> = new Set();

/**
 * The one way forms talk to Server Actions.
 *
 * Submits through `onSubmit` rather than `<form action>`: React resets an
 * action-bound form after every submission, which would wipe what someone typed
 * the moment the server says "this phone number is taken". Input is never lost.
 *
 * Given the action's schema, it also checks in the browser: on submit (nothing
 * is sent while a field is wrong), when a field is left, and as it changes once
 * it has shown an error, so the red clears the moment it is fixed. Server
 * errors still win, and one disappears as soon as its field is edited.
 */
export function useActionForm<T>(
  action: FormAction<T>,
  onSuccess?: (data: T) => void,
  options?: Options,
) {
  const tv = useTranslations('validation');
  const [, startTransition] = useTransition();
  const successRef = useRef(onSuccess);
  const formRef = useRef<HTMLFormElement | null>(null);
  const touched = useRef(new Set<string>());
  const submitted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [client, setClient] = useState<Record<string, string>>({});
  const [targets, setTargets] = useState<Record<string, { label: string | null }>>({});
  const [attempted, setAttempted] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);

  const [state, dispatch, pending] = useActionState<ActionResult<T> | null, FormData>(
    async (previous, formData) => {
      const result = await action(previous, formData);
      const form = formRef.current;
      if (result.ok) {
        // A form that stays open (or is reset) starts over: no field is flagged
        // again until it is left or the form is submitted.
        submitted.current = false;
        touched.current.clear();
        setAttempted(false);
      } else if (result.fields && form) {
        const fields = Object.keys(result.fields);
        setTargets((current) => ({ ...current, ...describeFields(form, fields) }));
        options?.onInvalid?.(fields);
      }
      return result;
    },
    null,
  );
  const [dismissed, setDismissed] = useState<{ state: typeof state; fields: Set<string> }>({
    state: null,
    fields: new Set(),
  });

  useEffect(() => {
    successRef.current = onSuccess;
  });

  useEffect(() => {
    if (state?.ok) successRef.current?.(state.data);
  }, [state]);

  const failure = state && !state.ok ? state : null;

  useEffect(() => {
    if (failure && formRef.current) revealFirstError(formRef.current);
  }, [failure]);

  useEffect(() => {
    if (focusRequest > 0 && formRef.current) revealFirstError(formRef.current);
  }, [focusRequest]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const translate = (message: string) => options?.translate?.(message) ?? message;

  /** The form's current errors by field, translated; nothing for the form as a whole. */
  function check(form: HTMLFormElement): Record<string, string> {
    const schema = options?.schema;
    if (!schema) return {};
    const raw = formDataToObject(new FormData(form));
    const parsed = schema.safeParse(options.prepare ? options.prepare(raw) : raw);
    if (parsed.success) return {};
    const found: Record<string, string> = {};
    for (const [field, keys] of Object.entries(fieldErrors(parsed.error))) {
      const key = keys[0];
      if (field === '_form' || key === undefined) continue;
      found[field] = translate(translateDynamic(tv, key, key));
    }
    return found;
  }

  function recheck(form: HTMLFormElement): void {
    const found = check(form);
    const everything = submitted.current;
    const seen = new Set(touched.current);
    setClient((current) =>
      everything
        ? found
        : Object.fromEntries(
            Object.entries(found).filter(([field]) => field in current || seen.has(field)),
          ),
    );
    setTargets((current) => ({ ...current, ...describeFields(form, Object.keys(found)) }));
  }

  const hidden = dismissed.state === state ? dismissed.fields : NOTHING;
  const errors: Record<string, string> = { ...client };
  for (const [field, messages] of Object.entries(failure?.fields ?? {})) {
    const message = messages[0];
    if (field === '_form' || hidden.has(field) || message === undefined) continue;
    errors[field] = translate(message);
  }

  return {
    state,
    pending,
    onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      formRef.current = form;
      submitted.current = true;
      setAttempted(true);

      const found = check(form);
      setClient(found);
      const fields = Object.keys(found);
      if (fields.length > 0) {
        setTargets((current) => ({ ...current, ...describeFields(form, fields) }));
        options?.onInvalid?.(fields);
        setFocusRequest((count) => count + 1);
        return;
      }

      const formData = new FormData(form);
      startTransition(() => dispatch(formData));
    },
    onChange: (event: React.ChangeEvent<HTMLFormElement>) => {
      const keys = keysOf(event.target);
      if (failure?.fields && keys.some((key) => failure.fields?.[key])) {
        setDismissed((current) => ({
          state,
          fields: new Set([...(current.state === state ? current.fields : []), ...keys]),
        }));
      }
      if (!options?.schema) return;
      // After React has rendered the change: one box can fill another (the
      // Hindi name from the English one), and the check must see both.
      const form = event.currentTarget;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => recheck(form), 0);
    },
    // Leaving a button counts too: adding or removing a row changes what is valid.
    onBlur: (event: React.FocusEvent<HTMLFormElement>) => {
      if (!options?.schema) return;
      for (const key of keysOf(event.target)) touched.current.add(key);
      recheck(event.currentTarget);
    },
    /** First message for a field, translated. */
    error: (field: string): string | undefined => errors[field],
    /** Every field error, for the summary above the form. Empty until the first submit. */
    fieldErrors: attempted
      ? Object.entries(errors).map(([field, message]): FieldErrorItem => ({
          field,
          message,
          target: targets[field] ?? null,
        }))
      : [],
    /** A failure not tied to one field, or a form-level one. */
    formError:
      failure && (!failure.fields || failure.fields._form)
        ? translate(failure.fields?._form?.[0] ?? failure.message)
        : null,
    traceId: failure?.traceId ?? null,
  };
}
