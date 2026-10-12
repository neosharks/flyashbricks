'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { IndianRupee } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { AmountInput } from '@/components/ui/amount-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { addPaymentAction } from '@/features/sales/actions';
import { useActionForm } from '@/hooks/use-action-form';
import { formatMoney, paiseToInput } from '@/lib/money';
import { PAYMENT_MODES, type PaymentMode } from '@/models/constants';
import { cn } from '@/lib/utils';

/** "Money received" against one bill. The full balance is one tap away. */
export function PaymentDialog({
  saleId,
  duePaise,
  today,
}: {
  saleId: string;
  duePaise: number;
  today: string;
}) {
  const t = useTranslations('sales');
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<PaymentMode>('cash');

  const form = useActionForm(addPaymentAction, () => {
    toast.success(t('payment.saved'));
    setOpen(false);
    setAmount('');
    router.refresh();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full sm:w-auto">
          <IndianRupee aria-hidden />
          {t('payment.add')}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={t('payment.title')}
        description={t('payment.description', { amount: formatMoney(duePaise, locale) })}
      >
        <form method="post" onSubmit={form.onSubmit} className="flex flex-col gap-4" noValidate>
          {form.formError && <Alert tone="danger">{form.formError}</Alert>}
          <input type="hidden" name="saleId" value={saleId} />

          <Field label={t('payment.amount')} required error={form.error('amount')}>
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAmount(paiseToInput(duePaise))}
                >
                  {t('payment.payFull')}
                </Button>
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
                  {t(`modes.${option}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label={t('payment.date')} required error={form.error('date')}>
            {(props) => (
              <Input {...props} type="date" name="date" defaultValue={today} max={today} required />
            )}
          </Field>

          <Field label={t('payment.note')} error={form.error('note')}>
            {(props) => <Input {...props} name="note" placeholder={t('payment.notePlaceholder')} />}
          </Field>

          <Button type="submit" size="lg" full loading={form.pending}>
            {t('payment.save')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
