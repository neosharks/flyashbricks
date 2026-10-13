import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { z } from 'zod';
import common from '@/messages/en/common.json';
import validation from '@/messages/en/validation.json';
import { Field } from '@/components/ui/field';
import { FormErrors } from '@/components/ui/form-errors';
import { Input } from '@/components/ui/input';
import type { ActionResult } from '@/lib/result';
import { useActionForm } from './use-action-form';

const Schema = z
  .object({
    name: z.string().trim().min(1),
    phone: z.string().regex(/^\d{10}$/, 'invalidPhone'),
  })
  .strict();

type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

function TestForm({ action, schema = true }: { action: Action; schema?: boolean }) {
  const form = useActionForm(action, undefined, schema ? { schema: Schema } : undefined);
  return (
    <form
      method="post"
      onSubmit={form.onSubmit}
      onChange={form.onChange}
      onBlur={form.onBlur}
      noValidate
    >
      <FormErrors form={form} />
      <Field label="Name" required error={form.error('name')}>
        {(props) => <Input {...props} name="name" />}
      </Field>
      <Field label="Phone" required error={form.error('phone')}>
        {(props) => <Input {...props} name="phone" />}
      </Field>
      <button type="submit">Save</button>
    </form>
  );
}

function renderForm(action: Action, schema = true) {
  render(
    <NextIntlClientProvider locale="en" messages={{ common, validation }} timeZone="Asia/Kolkata">
      <TestForm action={action} schema={schema} />
    </NextIntlClientProvider>,
  );
  return {
    name: screen.getByLabelText<HTMLInputElement>(/^Name/),
    phone: screen.getByLabelText<HTMLInputElement>(/^Phone/),
    save: screen.getByRole('button', { name: 'Save' }),
  };
}

const type = (input: HTMLInputElement, value: string) =>
  fireEvent.change(input, { target: { value } });

const succeed: Action = () => Promise.resolve({ ok: true, data: undefined });

describe('useActionForm', () => {
  it('blocks the submit and marks the field when the schema fails in the browser', async () => {
    const action = vi.fn(succeed);
    const { name, phone, save } = renderForm(action);
    type(name, 'Asha');
    type(phone, '123');

    fireEvent.click(save);

    expect(action).not.toHaveBeenCalled();
    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(phone).toHaveAccessibleDescription(validation.invalidPhone);
    expect(name).not.toHaveAttribute('aria-invalid');
    await waitFor(() => expect(phone).toHaveFocus());
  });

  it('moves focus to the first wrong field in reading order', async () => {
    const { name, save } = renderForm(vi.fn(succeed));
    fireEvent.click(save);
    await waitFor(() => expect(name).toHaveFocus());
  });

  it('clears the error as soon as the value is fixed', async () => {
    const { name, phone, save } = renderForm(vi.fn(succeed));
    type(name, 'Asha');
    fireEvent.click(save);
    expect(phone).toHaveAttribute('aria-invalid', 'true');

    type(phone, '9876543210');

    await waitFor(() => expect(phone).not.toHaveAttribute('aria-invalid'));
    expect(screen.queryByText(validation.invalidPhone)).not.toBeInTheDocument();
  });

  it('checks a field when it is left, before any submit', () => {
    const { phone } = renderForm(vi.fn(succeed));
    type(phone, '12');
    expect(phone).not.toHaveAttribute('aria-invalid');

    fireEvent.blur(phone);

    expect(phone).toHaveAttribute('aria-invalid', 'true');
  });

  it('sends the form once everything is valid', async () => {
    const action = vi.fn(succeed);
    const { name, phone, save } = renderForm(action);
    type(name, 'Asha');
    type(phone, '9876543210');

    fireEvent.click(save);

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get('phone')).toBe('9876543210');
  });

  it('lists every field error in a summary, including fields the form does not show', async () => {
    const action = vi.fn<Action>(() =>
      Promise.resolve({
        ok: false,
        code: 'VALIDATION_FAILED',
        message: 'Please check the highlighted fields.',
        fields: { phone: ['This number already belongs to another customer.'], ghost: ['Lost'] },
      }),
    );
    const { name, phone, save } = renderForm(action);
    type(name, 'Asha');
    type(phone, '9876543210');

    fireEvent.click(save);

    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('2 fields need attention');
    expect(within(summary).getByText('Lost')).toBeInTheDocument();
    const jump = within(summary).getByRole('button', { name: /Phone/ });
    expect(jump).toHaveTextContent('Phone: This number already belongs to another customer.');

    name.focus();
    fireEvent.click(jump);
    expect(phone).toHaveFocus();
  });

  it('drops a server error once its field is edited', async () => {
    const action = vi.fn<Action>(() =>
      Promise.resolve({
        ok: false,
        code: 'VALIDATION_FAILED',
        message: 'Please check the highlighted fields.',
        fields: { phone: ['This number already belongs to another customer.'] },
      }),
    );
    const { name, phone, save } = renderForm(action, false);
    type(name, 'Asha');
    type(phone, '9876543210');
    fireEvent.click(save);
    await waitFor(() => expect(phone).toHaveAttribute('aria-invalid', 'true'));
    await waitFor(() => expect(phone).toHaveFocus());

    type(phone, '9876543211');

    expect(phone).not.toHaveAttribute('aria-invalid');
  });

  it('shows a failure that belongs to no field on its own', async () => {
    const action = vi.fn<Action>(() =>
      Promise.resolve({ ok: false, code: 'RATE_LIMITED', message: 'Too many attempts.' }),
    );
    const { name, phone, save } = renderForm(action);
    type(name, 'Asha');
    type(phone, '9876543210');

    fireEvent.click(save);

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts.');
    expect(screen.queryByText(/need attention/)).not.toBeInTheDocument();
  });
});
