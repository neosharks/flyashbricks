'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AlertTriangle, ChevronDown, Factory, Plus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { FormErrors } from '@/components/ui/form-errors';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { localToday } from '@/components/raw-materials/today';
import { logProductionAction } from '@/features/production/actions';
import { LogProductionSchema } from '@/features/production/schema';
import { plannedConsumption } from '@/features/production/consumption';
import type { ProductOption } from '@/features/production/types';
import { useActionForm } from '@/hooks/use-action-form';
import { formatQuantity } from '@/lib/quantity';
import { cn } from '@/lib/utils';

function toCount(value: string): number {
  const cleaned = value.replace(/[,\s]/g, '');
  return /^\d{1,9}$/.test(cleaned) ? Number(cleaned) : 0;
}

/**
 * "Add bricks made": date, brick type and two numbers. The material it will
 * use is shown live, using the same calculation the server runs, so a shortage
 * is visible before saving rather than after.
 *
 * Opens on its own when the URL carries `?log=1` (the home-screen shortcut).
 */
export function LogProductionDialog({ products }: { products: ProductOption[] }) {
  const t = useTranslations('production');
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(searchParams.get('log') === '1');

  function change(next: boolean): void {
    setOpen(next);
    if (!next && searchParams.get('log')) router.replace(pathname, { scroll: false });
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full sm:w-auto">
          <Plus aria-hidden />
          {t('logButton')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('form.title')} description={t('form.description')}>
        {products.length === 0 ? (
          <div className="flex flex-col gap-3">
            <Alert tone="info">{t('form.noProducts')}</Alert>
            <Button asChild variant="outline">
              <Link href="/stock">{t('form.goToStock')}</Link>
            </Button>
          </div>
        ) : (
          <LogForm products={products} onDone={() => change(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LogForm({ products, onDone }: { products: ProductOption[]; onDone: () => void }) {
  const t = useTranslations('production.form');
  const tp = useTranslations('production');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();

  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [good, setGood] = useState('');
  const [defective, setDefective] = useState('');
  const [more, setMore] = useState(false);

  const form = useActionForm(
    logProductionAction,
    () => {
      toast.success(tp('toasts.logged'));
      onDone();
      router.refresh();
    },
    {
      schema: LogProductionSchema,
      onInvalid: (fields) => {
        if (fields.includes('note')) setMore(true);
      },
    },
  );

  const product = products.find((option) => option.id === productId);
  const bricks = toCount(good) + toCount(defective);
  const preview = useMemo(() => {
    if (!product) return [];
    const balances = new Map(product.recipe.map((line) => [line.materialId, line.availableMilli]));
    return plannedConsumption(product.recipe, product.recipeBatchSize, bricks, balances).map(
      (line) => ({
        ...line,
        material: product.recipe.find((item) => item.materialId === line.materialId),
      }),
    );
  }, [product, bricks]);
  const short = preview.filter((line) => line.short);

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

      {products.length === 1 ? (
        <>
          <input type="hidden" name="productId" value={productId} />
          <p className="bg-surface-muted rounded-md px-3 py-2 text-sm font-medium">
            {product?.name}
            {product?.size && (
              <span className="text-foreground-muted font-normal"> · {product.size}</span>
            )}
          </p>
        </>
      ) : (
        <Field label={t('brickType')} required error={form.error('productId')}>
          {(props) => (
            <Select
              {...props}
              name="productId"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              {products.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Field label={t('good')} required error={form.error('goodQty')}>
          {(props) => (
            <Input
              {...props}
              name="goodQty"
              inputMode="numeric"
              autoComplete="off"
              value={good}
              onChange={(event) => setGood(event.target.value)}
              className="text-lg font-semibold"
              required
              // eslint-disable-next-line jsx-a11y/no-autofocus -- the number the dialog was opened to enter
              autoFocus
            />
          )}
        </Field>
        <Field label={t('defective')} error={form.error('defectiveQty')}>
          {(props) => (
            <Input
              {...props}
              name="defectiveQty"
              inputMode="numeric"
              autoComplete="off"
              value={defective}
              onChange={(event) => setDefective(event.target.value)}
              placeholder="0"
              className="text-lg"
            />
          )}
        </Field>
      </div>

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

      <section aria-live="polite" className="border-border rounded-lg border p-3">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <Factory aria-hidden className="text-foreground-muted size-4" />
          {t('previewTitle')}
        </h3>
        {product?.recipe.length === 0 ? (
          <p className="text-foreground-muted text-sm">{t('noRecipe')}</p>
        ) : preview.length === 0 ? (
          <p className="text-foreground-muted text-sm">{t('previewEmpty')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {preview.map((line) => {
              const unit = line.material ? tc(`units.${line.material.unit}`) : '';
              return (
                <li key={line.materialId} className="flex items-baseline justify-between gap-3">
                  <span className={cn(line.short && 'text-danger font-medium')}>
                    {line.short && <AlertTriangle aria-hidden className="mr-1 inline size-3.5" />}
                    {line.material?.materialName}
                  </span>
                  <span className="text-right tabular-nums">
                    <strong>
                      {formatQuantity(line.needMilli, locale)} {unit}
                    </strong>
                    <span className="text-foreground-muted block text-xs">
                      {t('available', { have: formatQuantity(line.availableMilli, locale), unit })}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {short.map((line) => {
        const unit = line.material ? tc(`units.${line.material.unit}`) : '';
        return (
          <Alert key={line.materialId} tone="danger">
            {t('short', {
              name: line.material?.materialName ?? '',
              need: formatQuantity(line.needMilli, locale),
              have: formatQuantity(line.availableMilli, locale),
              unit,
            })}
          </Alert>
        );
      })}

      <button
        type="button"
        onClick={() => setMore((value) => !value)}
        aria-expanded={more}
        className="text-action inline-flex min-h-10 items-center gap-1 self-start text-sm font-medium"
      >
        <ChevronDown aria-hidden className={more ? 'size-4 rotate-180' : 'size-4'} />
        {more ? t('less') : t('more')}
      </button>
      <div className={more ? 'block' : 'hidden'}>
        <Field label={t('note')} error={form.error('note')}>
          {(props) => (
            <Input {...props} name="note" placeholder={t('notePlaceholder')} autoComplete="off" />
          )}
        </Field>
      </div>

      <Button
        type="submit"
        size="lg"
        loading={form.pending}
        disabled={short.length > 0}
        className="w-full"
      >
        {t('submit')}
      </Button>
    </form>
  );
}
