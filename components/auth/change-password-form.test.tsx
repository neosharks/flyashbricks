import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import auth from '@/messages/en/auth.json';
import common from '@/messages/en/common.json';
import validation from '@/messages/en/validation.json';
import { changePassword } from '@/features/auth/actions';
import { ChangePasswordForm } from './change-password-form';

vi.mock('@/features/auth/actions', () => ({ changePassword: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));

function renderForm() {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={{ auth, common, validation }}
      timeZone="Asia/Kolkata"
    >
      <ChangePasswordForm temporary={false} />
    </NextIntlClientProvider>,
  );
  return {
    current: screen.getByLabelText<HTMLInputElement>(/^Current password/),
    next: screen.getByLabelText<HTMLInputElement>(/^New password/),
    confirm: screen.getByLabelText<HTMLInputElement>(/^Confirm new password/),
    submit: screen.getByRole('button', { name: 'Change password' }),
  };
}

const type = (input: HTMLInputElement, value: string) =>
  fireEvent.change(input, { target: { value } });

describe('ChangePasswordForm', () => {
  it('says what is wrong with each field without asking the server', async () => {
    const { current, next, confirm, submit } = renderForm();
    type(next, 'short');
    type(confirm, 'different');

    fireEvent.click(submit);

    expect(changePassword).not.toHaveBeenCalled();
    expect(current).toHaveAccessibleDescription(validation.required);
    expect(next).toHaveAccessibleDescription(`${auth.passwordHint} ${validation.passwordTooShort}`);
    expect(confirm).toHaveAccessibleDescription(validation.passwordsDoNotMatch);

    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent('3 fields need attention');
    expect(within(summary).getByRole('button', { name: /^New password:/ })).toBeInTheDocument();
    await waitFor(() => expect(current).toHaveFocus());
  });

  it('submits once the passwords are fixed', async () => {
    vi.mocked(changePassword).mockResolvedValue({ ok: true, data: undefined });
    const { current, next, confirm, submit } = renderForm();
    type(current, 'old-password-1');
    type(next, 'a brand new sentence');
    type(confirm, 'a brand new sentence');

    fireEvent.click(submit);

    await waitFor(() => expect(changePassword).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
