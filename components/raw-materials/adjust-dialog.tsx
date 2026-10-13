'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { SlidersHorizontal } from 'lucide-react';
import { AmountInput } from '@/components/ui/amount-input';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { FormErrors } from '@/components/ui/form-errors';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { adjustMaterialAction } from '@/features/raw-materials/actions';
import { ADJUST_MODES, AdjustMaterialSchema } from '@/features/raw-materials/schema';
import { useActionForm } from '@/hooks/use-action-form';
import { formatQuantity } from '@/lib/quantity';
import { cn } from '@/lib/utils';
import type { Unit } from '@/models/constants';
import { localToday } from './today';

type Props = {
  material: { id: string; name: string; unit: Unit; quantityMilli: number };
  variant?: ButtonProps['variant'];
  className?: string;
};

type Mode = (typeof ADJUST_MODES)[number];

export function AdjustDialog({ material, variant = 'outline', className }: Props) {
  const t = useTranslations('rawMaterials');
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className={className}>
          <SlidersHorizontal aria-hidden />
          {t('adjust')}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={t('adjustForm.title', { name: material.name })}
        description={t('adjustForm.description')}
      >
        <AdjustForm material={material} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AdjustForm({ material, onDone }: Props & { onDone: () => void }) {
  const t = useTranslations('rawMaterials');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('set');

  const form = useActionForm(
    adjustMaterialAction,
    () => {
      toast.success(t('toasts.adjusted'));
      onDone();
      router.refresh();
    },
    { schema: AdjustMaterialSchema },
  );
  const unit = tc(`units.${material.unit}`);

  return (
    <form
      method="post"
      onSubmit={form.onSubmit}
      onChange={form.onChange}
      onBlur={form.onBlur}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormErrors form={form} />
      <input type="hidden" name="materialId" value={material.id} />

      <p className="bg-surface-muted rounded-md px-3 py-2 text-sm">
        {t('adjustForm.current', { qty: formatQuantity(material.quantityMilli, locale), unit })}
      </p>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('adjustForm.mode')}</legend>
        <div className="grid grid-cols-3 gap-2">
          {ADJUST_MODES.map((option) => (
            <label
              key={option}
              className={cn(
                'flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-2 text-center text-sm font-medium',
                mode === option
                  ? 'border-action bg-action-subtle text-action'
                  : 'border-border-strong',
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
              {t(`adjustForm.modes.${option}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label={mode === 'set' ? t('adjustForm.counted') : t('adjustForm.quantity')}
        required
        error={form.error('qtyMilli')}
      >
        {(props) => <AmountInput {...props} name="qtyMilli" suffix={unit} required />}
      </Field>

      <Field label={t('adjustForm.reason')} required error={form.error('reason')}>
        {(props) => (
          <Input
            {...props}
            name="reason"
            placeholder={t('adjustForm.reasonPlaceholder')}
            required
          />
        )}
      </Field>

      <Field label={t('adjustForm.date')} required error={form.error('date')}>
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

      <Button type="submit" size="lg" loading={form.pending} className="w-full">
        {t('adjustForm.submit')}
      </Button>
    </form>
  );
}
