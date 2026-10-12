'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { BilingualInput } from '@/components/ui/bilingual-input';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { DEFAULT_STATE_CODE, GST_STATES, STATE_CODES } from '@/lib/gst';
import { PhoneInput } from '@/components/ui/phone-input';
import { createCustomerAction, updateCustomerAction } from '@/features/customers/actions';
import type { CustomerRow } from '@/features/customers/types';
import { useActionForm } from '@/hooks/use-action-form';
import { LIMITS } from '@/models/constants';

type CustomerDialogProps = {
  /** The yard's own state, preselected for a new customer. */
  defaultStateCode?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent when adding. */
  customer?: CustomerRow;
};

/** Add and edit share one form; only the action and starting values differ. */
export function CustomerDialog({
  open,
  onOpenChange,
  customer,
  defaultStateCode,
}: CustomerDialogProps) {
  const t = useTranslations('customers');
  const tc = useTranslations('common');
  const router = useRouter();
  const editing = customer !== undefined;

  // Stable keys so removing a middle row does not shift what is typed in the others.
  const [rows, setRows] = useState(() =>
    (customer?.phones.length ? customer.phones : ['']).map((phone, index) => ({
      key: index,
      phone,
    })),
  );
  const [nextKey, setNextKey] = useState(rows.length);

  const create = useActionForm(createCustomerAction, (data) => {
    toast.success(t('created'));
    onOpenChange(false);
    router.push(`/customers/${data.id}`);
  });
  const update = useActionForm(updateCustomerAction, () => {
    toast.success(t('updated'));
    onOpenChange(false);
    router.refresh();
  });
  const form = editing ? update : create;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={editing ? t('form.editTitle') : t('form.newTitle')}
        description={t('form.description')}
      >
        <form method="post" onSubmit={form.onSubmit} className="flex flex-col gap-4" noValidate>
          {form.formError && <Alert tone="danger">{form.formError}</Alert>}
          {editing && <input type="hidden" name="id" value={customer.id} />}

          <BilingualInput
            label={t('form.name')}
            name="name"
            defaultEnglish={customer?.nameEn}
            defaultHindi={customer?.nameHi}
            required
            maxLength={120}
            errors={{ en: form.error('name'), hi: form.error('nameHi') }}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t('form.phones')}</legend>
            {rows.map((row, index) => (
              <div key={row.key} className="flex items-start gap-2">
                <Field
                  label={t('form.phone', { index: index + 1 })}
                  className="flex-1 [&>label]:sr-only"
                  required={index === 0}
                  error={
                    form.error(`phones.${index}`) ??
                    (index === 0 ? form.error('phones') : undefined)
                  }
                >
                  {(props) => (
                    <PhoneInput
                      {...props}
                      name="phones"
                      value={row.phone}
                      placeholder={t('form.phonePlaceholder')}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((item) =>
                            item.key === row.key ? { ...item, phone: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  )}
                </Field>
                {index === 0 ? (
                  <span className="bg-action-subtle text-action mt-2.5 rounded px-2 py-1 text-xs font-medium">
                    {t('form.primary')}
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-danger hover:bg-danger-subtle"
                    aria-label={t('form.removePhone', { index: index + 1 })}
                    onClick={() =>
                      setRows((current) => current.filter((item) => item.key !== row.key))
                    }
                  >
                    <X aria-hidden />
                  </Button>
                )}
              </div>
            ))}
            <p className="text-foreground-muted text-xs">{t('form.phoneHint')}</p>
            {rows.length < LIMITS.phonesPerCustomer && (
              <Button
                type="button"
                variant="ghost"
                className="self-start"
                onClick={() => {
                  setRows((current) => [...current, { key: nextKey, phone: '' }]);
                  setNextKey((key) => key + 1);
                }}
              >
                <Plus aria-hidden />
                {t('form.addPhone')}
              </Button>
            )}
          </fieldset>

          <BilingualInput
            label={t('form.city')}
            name="city"
            defaultEnglish={customer?.cityEn}
            defaultHindi={customer?.cityHi}
            maxLength={80}
            errors={{ en: form.error('city'), hi: form.error('cityHi') }}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('form.gstin')} hint={t('form.gstinHint')} error={form.error('gstin')}>
              {(props) => (
                <Input
                  {...props}
                  name="gstin"
                  defaultValue={customer?.gstin ?? ''}
                  autoCapitalize="characters"
                  maxLength={15}
                  className="uppercase"
                />
              )}
            </Field>
          </div>

          <Field label={t('form.state')} hint={t('form.stateHint')} error={form.error('stateCode')}>
            {(props) => (
              <Select
                {...props}
                name="stateCode"
                // A new customer starts in the business's own state (Uttar Pradesh by default).
                defaultValue={
                  customer ? (customer.stateCode ?? '') : (defaultStateCode ?? DEFAULT_STATE_CODE)
                }
              >
                <option value="">{t('form.stateNone')}</option>
                {STATE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code} · {GST_STATES[code]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <BilingualInput
            label={t('form.address')}
            name="address"
            defaultEnglish={customer?.addressEn}
            defaultHindi={customer?.addressHi}
            maxLength={300}
            errors={{ en: form.error('address'), hi: form.error('addressHi') }}
          />

          <Field label={t('form.notes')} error={form.error('notes')}>
            {(props) => (
              <Textarea
                {...props}
                name="notes"
                rows={2}
                className="min-h-16"
                defaultValue={customer?.notes ?? ''}
              />
            )}
          </Field>

          <Button type="submit" size="lg" full loading={form.pending}>
            {form.pending ? tc('saving') : editing ? t('form.save') : t('form.create')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A button that opens the dialog; for server-rendered pages. */
export function CustomerDialogButton({
  customer,
  children,
  variant = 'primary',
  defaultStateCode = null,
}: {
  customer?: CustomerRow;
  defaultStateCode?: string | null;
  children: React.ReactNode;
  variant?: 'primary' | 'outline';
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} className="w-full sm:w-auto">
        {children}
      </Button>
      {open && (
        <CustomerDialog
          open={open}
          onOpenChange={setOpen}
          defaultStateCode={defaultStateCode}
          {...(customer ? { customer } : {})}
        />
      )}
    </>
  );
}
