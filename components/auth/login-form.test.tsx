import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import auth from '@/messages/en/auth.json';
import common from '@/messages/en/common.json';
import errors from '@/messages/en/errors.json';
import validation from '@/messages/en/validation.json';
import { signInWithCredentials, signInWithPin } from '@/features/auth/actions';
import { LoginForm } from './login-form';

vi.mock('@/features/auth/actions', () => ({
  signInWithCredentials: vi.fn(),
  signInWithPin: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));

function renderForm(pinName: string | null) {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={{ auth, common, validation }}
      timeZone="Asia/Kolkata"
    >
      <LoginForm callbackUrl="/" pinName={pinName} />
    </NextIntlClientProvider>,
  );
}

const pinBox = () => screen.queryByLabelText<HTMLInputElement>(/^PIN/);
const phoneBox = () => screen.queryByLabelText<HTMLInputElement>(/^Phone number or email/);

describe('LoginForm', () => {
  it('asks only for the phone and password on a device without a PIN', () => {
    renderForm(null);

    expect(phoneBox()).toBeInTheDocument();
    expect(pinBox()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: auth.quickPin.usePin })).not.toBeInTheDocument();
  });

  it('opens on the PIN, with the password one tap away and back', () => {
    renderForm('Ramesh');

    expect(screen.getByText('Welcome back, Ramesh')).toBeInTheDocument();
    expect(pinBox()).toHaveAttribute('inputmode', 'numeric');
    expect(pinBox()).toHaveAttribute('autocomplete', 'off');
    expect(pinBox()).toHaveAttribute('maxlength', '6');
    expect(phoneBox()).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: auth.quickPin.usePassword }));
    expect(phoneBox()).toBeInTheDocument();
    expect(pinBox()).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: auth.quickPin.usePin }));
    expect(pinBox()).toBeInTheDocument();
  });

  it('checks the PIN is six digits before sending it', () => {
    renderForm('Ramesh');
    const pin = pinBox();
    if (!pin) throw new Error('no PIN box');
    fireEvent.change(pin, { target: { value: '12a' } });

    fireEvent.click(screen.getByRole('button', { name: auth.quickPin.signIn }));

    expect(signInWithPin).not.toHaveBeenCalled();
    expect(pin).toHaveAccessibleDescription(validation.pinFormat);
  });

  it('falls back to the password, saying why, once the PIN has been removed', async () => {
    vi.mocked(signInWithPin).mockResolvedValue({
      ok: false,
      code: 'PIN_LOCKED',
      message: errors.PIN_LOCKED,
    });
    renderForm('Ramesh');
    const pin = pinBox();
    if (!pin) throw new Error('no PIN box');
    fireEvent.change(pin, { target: { value: '482913' } });

    fireEvent.click(screen.getByRole('button', { name: auth.quickPin.signIn }));

    await waitFor(() => expect(phoneBox()).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(errors.PIN_LOCKED);
    expect(screen.queryByRole('button', { name: auth.quickPin.usePin })).not.toBeInTheDocument();
    expect(signInWithCredentials).not.toHaveBeenCalled();
  });
});
