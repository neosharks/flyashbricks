import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import common from '@/messages/en/common.json';
import settings from '@/messages/en/settings.json';
import validation from '@/messages/en/validation.json';
import { updateBusinessSettings } from '@/features/settings/actions';
import { BusinessSettingsSchema } from '@/features/settings/schema';
import type { BusinessSettingsValues } from '@/features/settings/queries';
import { formDataToObject } from '@/lib/validation';
import { BusinessSettingsForm } from './business-settings-form';

vi.mock('@/features/settings/actions', () => ({ updateBusinessSettings: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));

const values: BusinessSettingsValues = {
  name: 'Shree Bricks',
  nameHi: 'श्री ब्रिक्स',
  legalName: '',
  legalNameHi: '',
  address: '',
  addressHi: '',
  city: 'Jaipur',
  pincode: '302001',
  stateCode: '08',
  phone: '',
  email: '',
  gstRegistered: false,
  gstin: '',
  gstRateBps: 0,
  hsnCode: '6815',
  invoicePrefix: 'INV',
  bankAccountName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  bankName: '',
  upiId: '',
  invoiceTerms: '',
};

function renderForm() {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={{ common, settings, validation }}
      timeZone="Asia/Kolkata"
    >
      <BusinessSettingsForm values={values} />
    </NextIntlClientProvider>,
  );
}

describe('BusinessSettingsForm', () => {
  it('posts exactly the fields its schema accepts', async () => {
    vi.mocked(updateBusinessSettings).mockResolvedValue({ ok: true, data: undefined });
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: common.saveChanges }));

    await waitFor(() => expect(updateBusinessSettings).toHaveBeenCalledOnce());
    const formData = vi.mocked(updateBusinessSettings).mock.calls[0]?.[1];
    if (!formData) throw new Error('expected a submission');
    const parsed = BusinessSettingsSchema.safeParse(formDataToObject(formData));
    expect(parsed.success).toBe(true);
  });

  it('asks for the GSTIN, inside its section, once GST is switched on', async () => {
    renderForm();
    fireEvent.click(screen.getByLabelText(settings.gst.yes));

    fireEvent.click(screen.getByRole('button', { name: common.saveChanges }));

    expect(updateBusinessSettings).not.toHaveBeenCalled();
    const gstin = screen.getByLabelText(new RegExp(`^${settings.gst.gstin}`));
    expect(gstin).toHaveAttribute('aria-invalid', 'true');
    expect(gstin).toHaveAccessibleDescription(`${settings.gst.gstinHint} ${validation.required}`);
    await waitFor(() => expect(gstin).toHaveFocus());
  });
});
