'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BadgeIndianRupee, Gift, HandCoins, MinusCircle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { AmountInput } from '@/components/ui/amount-input';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Disclosure } from '@/components/ui/disclosure';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { recordStaffPaymentAction } from '@/features/staff/actions';
import { useActionForm } from '@/hooks/use-action-form';
import { formatMoney, paiseToInput } from '@/lib/money';
import { cn } from '@/lib/utils';
import { PAYMENT_MODES, type PaymentMode, type StaffPaymentType } from '@/models/constants';
import { useStaffErrors } from './use-staff-errors';

const ICONS = {
  wage: BadgeIndianRupee,
  advance: HandCoins,
  bonus: Gift,
  deduction: MinusCircle,
} as const;

/**
 * Money to or from one worker. For wages, the amount owed is one tap away and
 * the work period is filled in; everything else needs only an amount.
 */
export function StaffPaymentDialog({
  staffId,
  name,
  type,
  owedPaise,
  today,
  period,
  variant = 'outline',
  size = 'md',
  label,
}: {
  staffId: string;
  name: string;
  type: StaffPaymentType;
  owedPaise: number;
  today: string;
  period?: { from: string; to: string };
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  /** Overrides the button text, e.g. "Pay" in the wages table. */
  label?: string;
}) {
  const t = useTranslations('staff');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const translateError = useStaffErrors();
  const [open, setOpen] = useState(false);
  const owed = Math.max(0, owedPaise);
  const [amount, setAmount] = useState(type === 'wage' && owed > 0 ? paiseToInput(owed) : '');
  const [mode, setMode] = useState<PaymentMode>('cash');

  const form = useActionForm(recordStaffPaymentAction, () => {
    toast.success(t('payment.saved'));
    setOpen(false);
    router.refresh();
  });
  const Icon = ICONS[type];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Icon aria-hidden />
          {label ?? t(`payment.${type}`)}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={t(`payment.titles.${type}`, { name })}
        description={t(`payment.hints.${type}`)}
      >
        <form method="post" onSubmit={form.onSubmit} className="flex flex-col gap-4" noValidate>
          {form.formError && !form.error('amount') && <Alert tone="danger">{form.formError}</Alert>}
          <input type="hidden" name="staffId" value={staffId} />
          <input type="hidden" name="type" value={type} />

          {type === 'wage' && (
            <p className="text-foreground-muted text-sm">
              {t('payment.owedNow', { amount: formatMoney(owed, locale) })}
            </p>
          )}

          <Field label={t('payment.amount')} required error={translateError(form.error('amount'))}>
            {(props) => (
              <div className="flex gap-2">
                <div className="flex-1">
                  <AmountInput
                    {...props}
                    name="amount"
                    prefix="₹"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="text-lg"
                    required
                  />
                </div>
                {type === 'wage' && owed > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAmount(paiseToInput(owed))}
                  >
                    {t('payment.payOwed')}
                  </Button>
                )}
              </div>
            )}
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('payment.mode')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_MODES.map((option) => (
                <label
                  key={option}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-2 text-center text-sm font-medium',
                    mode === option
                      ? 'border-action bg-action-subtle text-action'
                      : 'border-border-strong hover:bg-surface-muted',
                  )}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={option}
                    checked={mode === option}
                    onChange={() => setMode(option)}
                    className="sr-only"
                  />
                  {t(`payment.modes.${option}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label={t('payment.date')} required error={translateError(form.error('date'))}>
            {(props) => (
              <Input {...props} type="date" name="date" defaultValue={today} max={today} required />
            )}
          </Field>

          <Disclosure
            summary={tc('moreOptions')}
            defaultOpen={type === 'wage' && period !== undefined}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={t('payment.periodFrom')}
                error={translateError(form.error('periodFrom'))}
              >
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    name="periodFrom"
                    max={today}
                    defaultValue={type === 'wage' ? (period?.from ?? '') : ''}
                  />
                )}
              </Field>
              <Field label={t('payment.periodTo')} error={translateError(form.error('periodTo'))}>
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    name="periodTo"
                    max={today}
                    defaultValue={type === 'wage' ? (period?.to ?? '') : ''}
                  />
                )}
              </Field>
              <Field
                label={t('payment.note')}
                error={translateError(form.error('note'))}
                className="sm:col-span-2"
              >
                {(props) => <Input {...props} name="note" />}
              </Field>
            </div>
          </Disclosure>

          <Button type="submit" size="lg" loading={form.pending}>
            {t('payment.save')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
