'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ChevronDown, PackagePlus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { AmountInput } from '@/components/ui/amount-input';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { recordPurchaseAction } from '@/features/raw-materials/actions';
import { ratePerUnit } from '@/features/raw-materials/forecast';
import { useActionForm } from '@/hooks/use-action-form';
import { formatMoney, parseRupees } from '@/lib/money';
import { parseQuantity } from '@/lib/quantity';
import type { Unit } from '@/models/constants';
import { localToday } from './today';

type Props = {
  material: { id: string; name: string; unit: Unit };
  variant?: ButtonProps['variant'];
  className?: string;
};

/** "New stock arrived": quantity and bill are all most deliveries need. */
export function PurchaseDialog({ material, variant = 'primary', className }: Props) {
  const t = useTranslations('rawMaterials');
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className={className}>
          <PackagePlus aria-hidden />
          {t('purchase')}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={t('purchaseForm.title', { name: material.name })}
        description={t('purchaseForm.description')}
      >
        <PurchaseForm material={material} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PurchaseForm({ material, onDone }: Props & { onDone: () => void }) {
  const t = useTranslations('rawMaterials');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const [more, setMore] = useState(false);
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');

  const form = useActionForm(recordPurchaseAction, () => {
    toast.success(t('toasts.purchased'));
    onDone();
    router.refresh();
  });

  const unit = tc(`units.${material.unit}`);
  const qtyMilli = parseQuantity(qty);
  const costPaise = parseRupees(cost);
  const rate = qtyMilli && costPaise ? ratePerUnit(costPaise, qtyMilli) : null;

  return (
    <form method="post" onSubmit={form.onSubmit} className="flex flex-col gap-4" noValidate>
      {form.formError && <Alert tone="danger">{form.formError}</Alert>}
      <input type="hidden" name="materialId" value={material.id} />

      <Field label={t('purchaseForm.quantity')} required error={form.error('qtyMilli')}>
        {(props) => (
          <AmountInput
            {...props}
            name="qtyMilli"
            suffix={unit}
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            required
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the one field every delivery needs; the dialog was opened to type it
            autoFocus
          />
        )}
      </Field>

      <Field
        label={t('purchaseForm.cost')}
        hint={
          rate
            ? t('purchaseForm.rateHint', { rate: formatMoney(rate, locale), unit })
            : t('purchaseForm.costHint')
        }
        error={form.error('costPaise')}
      >
        {(props) => (
          <AmountInput
            {...props}
            name="costPaise"
            prefix="₹"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            placeholder="0"
          />
        )}
      </Field>

      <Field label={t('purchaseForm.date')} required error={form.error('date')}>
        {(props) => (
          <Input
            {...props}
            type="date"
            name="date"
            defaultValue={localToday()}
            max={localToday()}
            required
          />
        )}
      </Field>

      <button
        type="button"
        onClick={() => setMore((value) => !value)}
        aria-expanded={more}
        className="text-action inline-flex min-h-10 items-center gap-1 self-start text-sm font-medium"
      >
        <ChevronDown aria-hidden className={more ? 'size-4 rotate-180' : 'size-4'} />
        {more ? t('form.lessOptions') : t('form.moreOptions')}
      </button>
      <div className={more ? 'flex flex-col gap-4' : 'hidden'}>
        <Field label={t('purchaseForm.supplier')} error={form.error('supplier')}>
          {(props) => <Input {...props} name="supplier" autoComplete="off" />}
        </Field>
        <Field label={t('purchaseForm.note')} error={form.error('note')}>
          {(props) => <Input {...props} name="note" autoComplete="off" />}
        </Field>
      </div>

      <Button type="submit" size="lg" loading={form.pending} className="w-full">
        <PackagePlus aria-hidden />
        {t('purchaseForm.submit')}
      </Button>
    </form>
  );
}
