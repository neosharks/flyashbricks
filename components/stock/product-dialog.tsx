'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { AmountInput } from '@/components/ui/amount-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { BilingualInput } from '@/components/ui/bilingual-input';
import { FormErrors } from '@/components/ui/form-errors';
import { Field, FieldError } from '@/components/ui/field';
import { Checkbox, Input, Select } from '@/components/ui/input';
import { createProductAction, updateProductAction } from '@/features/stock/actions';
import { CreateProductSchema, foldRecipe, UpdateProductSchema } from '@/features/stock/schema';
import type { MaterialOption } from '@/features/raw-materials/types';
import type { ProductRow } from '@/features/stock/types';
import { useActionForm } from '@/hooks/use-action-form';
import { paiseToInput } from '@/lib/money';
import { quantityToInput } from '@/lib/quantity';
import { LIMITS } from '@/models/constants';

type Props = {
  product?: ProductRow | undefined;
  materials: MaterialOption[];
};

type Line = { key: number; materialId: string; qty: string };

let nextKey = 0;

/** Add or edit a brick type, including its mix (recipe). */
export function ProductDialog({ product, materials }: Props) {
  const t = useTranslations('production');
  const [open, setOpen] = useState(false);
  const editing = product !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="sm">
            <Pencil aria-hidden />
            {t('stock.editType')}
          </Button>
        ) : (
          <Button size="lg" className="w-full sm:w-auto">
            <Plus aria-hidden />
            {t('stock.addType')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={
          editing
            ? t('productForm.editTitle', { name: product.name })
            : t('productForm.createTitle')
        }
        description={t('productForm.description')}
      >
        <ProductForm product={product} materials={materials} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ProductForm({ product, materials, onDone }: Props & { onDone: () => void }) {
  const t = useTranslations('production.productForm');
  const tc = useTranslations('common');
  const router = useRouter();
  const editing = product !== undefined;
  const batchErrorId = useId();

  const [lines, setLines] = useState<Line[]>(() =>
    product && product.recipe.length > 0
      ? product.recipe.map((line) => ({
          key: nextKey++,
          materialId: line.materialId,
          qty: quantityToInput(line.qtyMilli),
        }))
      : [{ key: nextKey++, materialId: '', qty: '' }],
  );

  const onSuccess = (message: string) => () => {
    toast.success(message);
    onDone();
    router.refresh();
  };
  const create = useActionForm(createProductAction, onSuccess(t('created')), {
    schema: CreateProductSchema,
    prepare: foldRecipe,
  });
  const update = useActionForm(updateProductAction, onSuccess(t('updated')), {
    schema: UpdateProductSchema,
    prepare: foldRecipe,
  });
  const form = editing ? update : create;

  // `foldRecipe` drops empty rows before numbering, so `recipe.1` is the second filled row.
  const recipeIndex = new Map<number, number>();
  for (const line of lines) {
    if (line.materialId !== '' || line.qty !== '') recipeIndex.set(line.key, recipeIndex.size);
  }

  const unitOf = (materialId: string) => {
    const material = materials.find((option) => option.id === materialId);
    return material ? tc(`units.${material.unit}`) : '';
  };

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
      {editing && <input type="hidden" name="id" value={product.id} />}

      <BilingualInput
        label={t('name')}
        name="name"
        defaultEnglish={product?.nameEn}
        defaultHindi={product?.nameHi}
        required
        maxLength={80}
        errors={{ en: form.error('name'), hi: form.error('nameHi') }}
      />

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Field label={t('rate')} error={form.error('defaultRatePaise')}>
          {(props) => (
            <AmountInput
              {...props}
              name="defaultRatePaise"
              prefix="₹"
              defaultValue={product ? paiseToInput(product.defaultRatePaise) : ''}
            />
          )}
        </Field>
        <Field label={t('size')} error={form.error('size')}>
          {(props) => (
            <Input
              {...props}
              name="size"
              defaultValue={product?.size ?? ''}
              placeholder={t('sizePlaceholder')}
            />
          )}
        </Field>
      </div>

      <fieldset className="border-border flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">{t('mixTitle')}</legend>

        <div>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            {t('batch')}
            <Input
              name="recipeBatchSize"
              inputMode="numeric"
              defaultValue={product?.recipeBatchSize ?? 100}
              className="min-h-10 w-24 px-2 tabular-nums"
              aria-invalid={form.error('recipeBatchSize') ? true : undefined}
              aria-describedby={form.error('recipeBatchSize') ? batchErrorId : undefined}
            />
            {t('batchSuffix')}
          </label>
          <div aria-live="polite">
            {form.error('recipeBatchSize') && (
              <FieldError id={batchErrorId}>{form.error('recipeBatchSize')}</FieldError>
            )}
          </div>
        </div>

        <div>
          {materials.length === 0 ? (
            <p className="text-foreground-muted text-sm">{t('noMaterials')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lines.map((line) => {
                const name = materials.find((option) => option.id === line.materialId)?.name ?? '';
                const index = recipeIndex.get(line.key);
                const materialKey = `recipe.${index ?? -1}.materialId`;
                const qtyKey = `recipe.${index ?? -1}.qtyMilli`;
                const materialError = form.error(materialKey);
                const qtyError = form.error(qtyKey);
                const errorId = `recipe-error-${line.key}`;
                return (
                  <li key={line.key} className="flex flex-col">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <label className="sr-only" htmlFor={`recipe-material-${line.key}`}>
                          {t('material')}
                        </label>
                        <Select
                          id={`recipe-material-${line.key}`}
                          name="recipe_materialId"
                          value={line.materialId}
                          onChange={(event) =>
                            setLines((current) =>
                              current.map((item) =>
                                item.key === line.key
                                  ? { ...item, materialId: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          data-error-key={materialKey}
                          aria-invalid={materialError ? true : undefined}
                          aria-describedby={materialError ? errorId : undefined}
                        >
                          <option value="">{t('choose')}</option>
                          {materials.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="w-32 shrink-0">
                        <label className="sr-only" htmlFor={`recipe-qty-${line.key}`}>
                          {t('amount')}
                        </label>
                        <AmountInput
                          id={`recipe-qty-${line.key}`}
                          name="recipe_qty"
                          value={line.qty}
                          suffix={unitOf(line.materialId)}
                          onChange={(event) =>
                            setLines((current) =>
                              current.map((item) =>
                                item.key === line.key ? { ...item, qty: event.target.value } : item,
                              ),
                            )
                          }
                          data-error-key={qtyKey}
                          aria-invalid={qtyError ? true : undefined}
                          aria-describedby={qtyError ? errorId : undefined}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-danger hover:bg-danger-subtle"
                        onClick={() =>
                          setLines((current) => current.filter((item) => item.key !== line.key))
                        }
                        aria-label={t('removeMaterial', { name: name || t('material') })}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                    <div aria-live="polite">
                      {(materialError ?? qtyError) && (
                        <FieldError id={errorId}>
                          {[materialError, qtyError].filter(Boolean).join(' ')}
                        </FieldError>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div aria-live="polite">
            {form.error('recipe') && <FieldError>{form.error('recipe')}</FieldError>}
          </div>
        </div>

        {materials.length > 0 && lines.length < LIMITS.recipeItems && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              setLines((current) => [...current, { key: nextKey++, materialId: '', qty: '' }])
            }
          >
            <Plus aria-hidden />
            {t('addMaterial')}
          </Button>
        )}
      </fieldset>

      <Field label={t('lowStock')} hint={t('lowStockHint')} error={form.error('lowStockThreshold')}>
        {(props) => (
          <Input
            {...props}
            name="lowStockThreshold"
            inputMode="numeric"
            defaultValue={product?.lowStockThreshold ?? 0}
          />
        )}
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isActive" defaultChecked={product?.isActive ?? true} />
        {t('active')}
      </label>

      <Button type="submit" size="lg" loading={form.pending} className="w-full">
        {editing ? t('save') : t('create')}
      </Button>
    </form>
  );
}
