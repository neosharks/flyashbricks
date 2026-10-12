'use client';

import { useActionState, useEffect, useRef, useTransition } from 'react';
import type { ActionResult } from '@/lib/result';

type FormAction<T> = (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;

/**
 * The one way forms talk to Server Actions.
 *
 * Submits through `onSubmit` rather than `<form action>`: React resets an
 * action-bound form after every submission, which would wipe what someone typed
 * the moment the server says "this phone number is taken". Input is never lost.
 */
export function useActionForm<T>(action: FormAction<T>, onSuccess?: (data: T) => void) {
  const [state, dispatch, pending] = useActionState<ActionResult<T> | null, FormData>(action, null);
  const [, startTransition] = useTransition();
  const successRef = useRef(onSuccess);

  useEffect(() => {
    successRef.current = onSuccess;
  });

  useEffect(() => {
    if (state?.ok) successRef.current?.(state.data);
  }, [state]);

  const failure = state && !state.ok ? state : null;

  return {
    state,
    pending,
    onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      startTransition(() => dispatch(formData));
    },
    /** First message for a field, already translated by the server. */
    error: (field: string): string | undefined => failure?.fields?.[field]?.[0],
    /** A failure not tied to one field, or a form-level one. */
    formError:
      failure && (!failure.fields || failure.fields._form)
        ? (failure.fields?._form?.[0] ?? failure.message)
        : null,
    traceId: failure?.traceId ?? null,
  };
}
