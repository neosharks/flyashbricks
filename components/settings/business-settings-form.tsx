'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Building2, Landmark, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { BilingualInput } from '@/components/ui/bilingual-input';
import { FormErrors } from '@/components/ui/form-errors';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { updateBusinessSettings } from '@/features/settings/actions';
import { BusinessSettingsSchema, GST_RATES_BPS } from '@/features/settings/schema';
import type { BusinessSettingsValues } from '@/features/settings/queries';
import { useActionForm } from '@/hooks/use-action-form';
import { GST_STATES, STATE_CODES } from '@/lib/gst';
import { cn } from '@/lib/utils';

function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Building2;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-surface rounded-lg border p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="bg-action-subtle text-action rounded-md p-2">
          <Icon aria-hidden className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-foreground-muted text-sm">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function BusinessSettingsForm({ values }: { values: BusinessSettingsValues }) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const router = useRouter();
  const [gst, setGst] = useState(values.gstRegistered);
  const form = useActionForm(
    updateBusinessSettings,
    () => {
      toast.success(t('saved'));
      router.refresh();
    },
    { schema: BusinessSettingsSchema },
  );

  return (
    <form
      method="post"
      onSubmit={form.onSubmit}
      onChange={form.onChange}
      onBlur={form.onBlur}
      className="flex flex-col gap-6"
      noValidate
    >
      <FormErrors form={form} />

      <Section icon={Building2} title={t('business.title')} hint={t('business.hint')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <BilingualInput
              label={t('business.name')}
              name="name"
              defaultEnglish={values.name}
              defaultHindi={values.nameHi}
              required
              maxLength={120}
              errors={{ en: form.error('name'), hi: form.error('nameHi') }}
            />
          </div>
          <Field label={t('business.phone')} error={form.error('phone')}>
            {(props) => (
              <Input
                {...props}
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="98765 43210"
                defaultValue={values.phone}
              />
            )}
          </Field>
          <div className="sm:col-span-2">
            <BilingualInput
              label={t('business.address')}
              name="address"
              defaultEnglish={values.address}
              defaultHindi={values.addressHi}
              maxLength={300}
              errors={{ en: form.error('address'), hi: form.error('addressHi') }}
            />
          </div>
          <Field label={t('business.city')} error={form.error('city')}>
            {(props) => <Input {...props} name="city" defaultValue={values.city} />}
          </Field>
          <Field label={t('business.pincode')} error={form.error('pincode')}>
            {(props) => (
              <Input
                {...props}
                name="pincode"
                inputMode="numeric"
                maxLength={6}
                defaultValue={values.pincode}
              />
            )}
          </Field>
          <Field label={t('business.state')} error={form.error('stateCode')}>
            {(props) => (
              <Select {...props} name="stateCode" defaultValue={values.stateCode}>
                <option value="">{t('business.chooseState')}</option>
                {STATE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {GST_STATES[code]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('business.email')} error={form.error('email')}>
            {(props) => (
              <Input
                {...props}
                name="email"
                type="email"
                inputMode="email"
                defaultValue={values.email}
              />
            )}
          </Field>
        </div>
        <Disclosure summary={tc('moreOptions')} className="mt-4">
          <p className="text-foreground-muted mb-3 text-xs">{t('business.legalNameHint')}</p>
          <BilingualInput
            label={t('business.legalName')}
            name="legalName"
            defaultEnglish={values.legalName}
            defaultHindi={values.legalNameHi}
            maxLength={160}
            errors={{ en: form.error('legalName'), hi: form.error('legalNameHi') }}
          />
        </Disclosure>
      </Section>

      <Section icon={ReceiptText} title={t('gst.title')} hint={t('gst.hint')}>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t('gst.question')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {[false, true].map((option) => (
              <label
                key={String(option)}
                className={cn(
                  'flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-medium',
                  gst === option
                    ? 'border-action bg-action-subtle text-action'
                    : 'border-border hover:bg-surface-muted',
                )}
              >
                <input
                  type="radio"
                  name="gstRegistered"
                  value={String(option)}
                  className="sr-only"
                  checked={gst === option}
                  onChange={() => setGst(option)}
                />
                {option ? t('gst.yes') : t('gst.no')}
              </label>
            ))}
          </div>
        </fieldset>

        {gst ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field
              label={t('gst.gstin')}
              hint={t('gst.gstinHint')}
              required
              error={form.error('gstin')}
              className="sm:col-span-3"
            >
              {(props) => (
                <Input
                  {...props}
                  name="gstin"
                  defaultValue={values.gstin}
                  maxLength={15}
                  autoCapitalize="characters"
                  className="font-mono uppercase"
                  placeholder="08ABCDE1234F1Z5"
                />
              )}
            </Field>
            <Field label={t('gst.rate')} required error={form.error('gstRateBps')}>
              {(props) => (
                <Select {...props} name="gstRateBps" defaultValue={String(values.gstRateBps)}>
                  {GST_RATES_BPS.map((bps) => (
                    <option key={bps} value={bps}>
                      {bps / 100}%
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label={t('gst.hsn')}
              hint={t('gst.hsnHint')}
              error={form.error('hsnCode')}
              className="sm:col-span-2"
            >
              {(props) => (
                <Input
                  {...props}
                  name="hsnCode"
                  inputMode="numeric"
                  defaultValue={values.hsnCode}
                />
              )}
            </Field>
          </div>
        ) : (
          <>
            <p className="text-foreground-muted mt-3 text-sm">{t('gst.noGstNote')}</p>
            {/* Kept so the schema always receives a rate; ignored without GST. */}
            <input type="hidden" name="gstRateBps" value="0" />
            <input type="hidden" name="gstin" value="" />
            <input type="hidden" name="hsnCode" value={values.hsnCode} />
          </>
        )}
      </Section>

      <Section icon={Landmark} title={t('payment.title')} hint={t('payment.hint')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={t('payment.upi')}
            hint={t('payment.upiHint')}
            error={form.error('upiId')}
            className="sm:col-span-2"
          >
            {(props) => (
              <Input
                {...props}
                name="upiId"
                autoCapitalize="none"
                placeholder="name@okaxis"
                defaultValue={values.upiId}
              />
            )}
          </Field>
          <Field label={t('payment.accountName')} error={form.error('bankAccountName')}>
            {(props) => (
              <Input {...props} name="bankAccountName" defaultValue={values.bankAccountName} />
            )}
          </Field>
          <Field label={t('payment.bankName')} error={form.error('bankName')}>
            {(props) => <Input {...props} name="bankName" defaultValue={values.bankName} />}
          </Field>
          <Field label={t('payment.accountNumber')} error={form.error('bankAccountNumber')}>
            {(props) => (
              <Input
                {...props}
                name="bankAccountNumber"
                inputMode="numeric"
                defaultValue={values.bankAccountNumber}
              />
            )}
          </Field>
          <Field label={t('payment.ifsc')} error={form.error('bankIfsc')}>
            {(props) => (
              <Input
                {...props}
                name="bankIfsc"
                autoCapitalize="characters"
                className="uppercase"
                maxLength={11}
                defaultValue={values.bankIfsc}
              />
            )}
          </Field>
        </div>
        <Disclosure summary={tc('moreOptions')} className="mt-4">
          <div className="flex flex-col gap-4">
            <Field
              label={t('invoice.terms')}
              hint={t('invoice.termsHint')}
              error={form.error('invoiceTerms')}
            >
              {(props) => (
                <Textarea {...props} name="invoiceTerms" defaultValue={values.invoiceTerms} />
              )}
            </Field>
            <Field
              label={t('invoice.prefix')}
              hint={t('invoice.prefixHint')}
              required
              error={form.error('invoicePrefix')}
            >
              {(props) => (
                <Input
                  {...props}
                  name="invoicePrefix"
                  maxLength={5}
                  className="max-w-32 uppercase"
                  defaultValue={values.invoicePrefix}
                  required
                />
              )}
            </Field>
          </div>
        </Disclosure>
      </Section>

      <div className="border-border bg-surface/95 sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-4 border-t px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
        <Button type="submit" size="lg" loading={form.pending} className="w-full sm:w-auto">
          {form.pending ? tc('saving') : tc('saveChanges')}
        </Button>
      </div>
    </form>
  );
}
