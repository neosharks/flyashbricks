'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { FormErrors } from '@/components/ui/form-errors';
import { addPaymentAction } from '@/features/sales/actions';
import { AddPaymentSchema } from '@/features/sales/schema';
import { useActionForm } from '@/hooks/use-action-form';
import { formatMoney, paiseToInput, parseRupees } from '@/lib/money';
import { formatNumber } from '@/lib/utils';
import { DoneScreen } from './done-screen';
import { ModePicker, type Mode } from './mode-picker';
import { NumberPad } from './number-pad';
import { TaskFrame } from './task-frame';

/** The last step of "money received": how much came in against this bill, and how. */
export function QuickPayment({
  title,
  steps,
  backHref,
  today,
  sale,
}: {
  title: string;
  steps: number;
  backHref: string;
  today: string;
  sale: { id: string; label: string; customerName: string; duePaise: number };
}) {
  const t = useTranslations('quick');
  const locale = useLocale();
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<Mode>('cash');
  const [saved, setSaved] = useState(false);

  const form = useActionForm(addPaymentAction, () => setSaved(true), {
    schema: AddPaymentSchema,
  });

  const money = (paise: number) => formatMoney(paise, locale);
  const paise = parseRupees(amount) ?? 0;
  const full = paiseToInput(sale.duePaise);
  const round = [5_000, 10_000, 20_000, 50_000]
    .filter((rupees) => rupees * 100 < sale.duePaise)
    .map((rupees) => ({ label: `₹${formatNumber(rupees, locale)}`, value: String(rupees) }));

  if (saved) {
    return (
      <DoneScreen
        title={t('payment.done')}
        detail={t('payment.doneDetail', { amount: money(paise), name: sale.customerName })}
        again={t('payment.again')}
        onAgain={() => router.push('/quick/payment')}
        home={t('backHome')}
      />
    );
  }

  if (sale.duePaise <= 0) {
    return (
      <TaskFrame
        title={title}
        step={2}
        steps={steps}
        question={t('payment.alreadyPaid', { bill: sale.label })}
        backHref={backHref}
      >
        <Button asChild size="lg" full>
          <Link href="/quick/payment">{t('payment.again')}</Link>
        </Button>
      </TaskFrame>
    );
  }

  return (
    <form method="post" onSubmit={form.onSubmit} noValidate>
      <input type="hidden" name="saleId" value={sale.id} />
      <input type="hidden" name="amount" value={amount} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="date" value={today} />
      <TaskFrame
        title={title}
        step={2}
        steps={steps}
        question={t('payment.howMuch', { name: sale.customerName })}
        backHref={backHref}
        footer={
          <Button
            type="submit"
            size="lg"
            full
            loading={form.pending}
            disabled={paise <= 0 || paise > sale.duePaise}
          >
            {form.pending
              ? t('saving')
              : paise > 0
                ? t('payment.save', { amount: money(paise) })
                : t('save')}
          </Button>
        }
      >
        <FormErrors form={form} />
        <NumberPad
          label={t('payment.amount', { bill: sale.label })}
          value={amount}
          onChange={setAmount}
          prefix="₹"
          decimals={2}
          presets={[
            { label: t('payment.full', { amount: money(sale.duePaise) }), value: full },
            ...round,
          ]}
          format={(value) => {
            const [whole = '0', fraction] = value.split('.');
            return (
              formatNumber(Number(whole), locale) + (fraction !== undefined ? `.${fraction}` : '')
            );
          }}
          hint={t('payment.due', { amount: money(sale.duePaise) })}
          error={paise > sale.duePaise ? t('payment.tooMuch') : undefined}
        />
        <ModePicker value={mode} onChange={setMode} label={t('payment.how')} />
      </TaskFrame>
    </form>
  );
}
