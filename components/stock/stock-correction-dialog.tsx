'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { FormErrors } from '@/components/ui/form-errors';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { localToday } from '@/components/raw-materials/today';
import { adjustStockAction } from '@/features/stock/actions';
import { AdjustStockSchema, STOCK_ADJUST_MODES } from '@/features/stock/schema';
import { useActionForm } from '@/hooks/use-action-form';
import { cn, formatNumber } from '@/lib/utils';

type Product = { id: string; name: string; stockGood: number };
type Mode = (typeof STOCK_ADJUST_MODES)[number];

export function StockCorrectionDialog({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const t = useTranslations('production');
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <SlidersHorizontal aria-hidden />
          {t('stock.correct')}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={t('stockForm.title', { name: product.name })}
        description={t('stockForm.description')}
      >
        <CorrectionForm product={product} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CorrectionForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const t = useTranslations('production.stockForm');
  const locale = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('remove');
  const form = useActionForm(
    adjustStockAction,
    () => {
      toast.success(t('done'));
      onDone();
      router.refresh();
    },
    { schema: AdjustStockSchema },
  );

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
      <input type="hidden" name="productId" value={product.id} />

      <p className="bg-surface-muted rounded-md px-3 py-2 text-sm">
        {t('current', { count: formatNumber(product.stockGood, locale) })}
      </p>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('mode')}</legend>
        <div className="grid grid-cols-3 gap-2">
          {STOCK_ADJUST_MODES.map((option) => (
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
              {t(`modes.${option}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label={mode === 'set' ? t('counted') : t('quantity')}
        required
        error={form.error('qty')}
      >
        {(props) => <Input {...props} name="qty" inputMode="numeric" autoComplete="off" required />}
      </Field>
      <Field label={t('reason')} required error={form.error('reason')}>
        {(props) => (
          <Input {...props} name="reason" placeholder={t('reasonPlaceholder')} required />
        )}
      </Field>
      <Field label={t('date')} required error={form.error('date')}>
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
        {t('submit')}
      </Button>
    </form>
  );
}
