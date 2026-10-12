'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from './button';

type SubmitButtonProps = Omit<ButtonProps, 'type' | 'loading'> & { pendingLabel?: string };

/**
 * Reads the enclosing form's pending state, so it must be rendered inside the
 * <form>, not by the component that renders the form.
 */
export function SubmitButton({ children, pendingLabel, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending} disabled={disabled ?? false} {...props}>
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
