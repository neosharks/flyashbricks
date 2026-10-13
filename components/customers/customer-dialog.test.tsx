import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import common from '@/messages/en/common.json';
import customers from '@/messages/en/customers.json';
import validation from '@/messages/en/validation.json';
import { createCustomerAction } from '@/features/customers/actions';
import { CustomerDialog } from './customer-dialog';

vi.mock('@/features/customers/actions', () => ({
  createCustomerAction: vi.fn(),
  updateCustomerAction: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));

function renderDialog() {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={{ common, customers, validation }}
      timeZone="Asia/Kolkata"
    >
      <CustomerDialog open onOpenChange={() => undefined} />
    </NextIntlClientProvider>,
  );
}

const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });

describe('CustomerDialog', () => {
  it('puts a phone error on the row that has it, even after an empty row', () => {
    renderDialog();
    type(screen.getByLabelText(/^Name — English/), 'Sharma Builders');
    fireEvent.click(screen.getByRole('button', { name: 'Add another number' }));
    const first = screen.getByLabelText('Phone number 1');
    const second = screen.getByLabelText(/^Phone number 2/);
    type(second, '123');

    fireEvent.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(createCustomerAction).not.toHaveBeenCalled();
    expect(second).toHaveAttribute('aria-invalid', 'true');
    expect(second).toHaveAccessibleDescription(validation.invalidPhone);
    expect(first).not.toHaveAttribute('aria-invalid');
  });

  it('asks for a name before anything is sent', () => {
    renderDialog();
    type(screen.getByLabelText('Phone number 1'), '98765 43210');

    fireEvent.click(screen.getByRole('button', { name: 'Add customer' }));

    expect(createCustomerAction).not.toHaveBeenCalled();
    const english = screen.getByLabelText(/^Name — English/);
    expect(english).toHaveAttribute('aria-invalid', 'true');
    expect(english).toHaveAccessibleDescription(validation.required);
  });
});
