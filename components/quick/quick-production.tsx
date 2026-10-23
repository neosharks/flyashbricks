'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormErrors } from '@/components/ui/form-errors';
import { logProductionAction } from '@/features/production/actions';
import { plannedConsumption } from '@/features/production/consumption';
import { LogProductionSchema } from '@/features/production/schema';
import type { ProductOption } from '@/features/production/types';
import { useActionForm } from '@/hooks/use-action-form';
import { formatQuantity } from '@/lib/quantity';
import { formatNumber } from '@/lib/utils';
import { BigChoice } from './big-choice';
import { DoneScreen } from './done-screen';
import { NumberPad } from './number-pad';
import { Summary, SummaryRow } from './summary';
import { TaskFrame } from './task-frame';

type Step = 'product' | 'good' | 'broken' | 'check';

/** "Bricks made today": brick type, good bricks, broken bricks, check, save. */
export function QuickProduction({ products, today }: { products: ProductOption[]; today: string }) {
  const t = useTranslations('quick');
  const tc = useTranslations('common');
  const tf = useTranslations('production.form');
  const locale = useLocale();
  const single = products.length === 1;
  const steps: Step[] = single
    ? ['good', 'broken', 'check']
    : ['product', 'good', 'broken', 'check'];

  const [step, setStep] = useState(0);
  const [productId, setProductId] = useState(single ? (products[0]?.id ?? '') : '');
  const [good, setGood] = useState('');
  const [broken, setBroken] = useState('');
  const [saved, setSaved] = useState(false);

  const form = useActionForm(logProductionAction, () => setSaved(true), {
    schema: LogProductionSchema,
  });

  const product = products.find((option) => option.id === productId);
  const count = (text: string) => (text === '' ? 0 : Number(text));
  const total = count(good) + count(broken);
  const usage = useMemo(() => {
    if (!product) return [];
    const balances = new Map(product.recipe.map((line) => [line.materialId, line.availableMilli]));
    return plannedConsumption(product.recipe, product.recipeBatchSize, total, balances).map(
      (line) => ({
        ...line,
        material: product.recipe.find((m) => m.materialId === line.materialId),
      }),
    );
  }, [product, total]);
  const short = usage.filter((line) => line.short);

  const current = steps[step] ?? 'check';
  const next = () => setStep((value) => Math.min(value + 1, steps.length - 1));
  const back = () => setStep((value) => Math.max(value - 1, 0));
  const title = t('tasks.production.title');
  const format = (value: string) => formatNumber(Number(value), locale);
  const presets = [1000, 2000, 3000, 5000, 6000, 8000].map((value) => ({
    label: formatNumber(value, locale),
    value: String(value),
  }));

  if (products.length === 0) {
    return (
      <TaskFrame title={title} step={0} steps={1} question={t('production.noProducts')}>
        <Alert tone="info">{t('askAdmin')}</Alert>
      </TaskFrame>
    );
  }

  if (saved) {
    return (
      <DoneScreen
        title={t('production.done')}
        detail={t('production.doneDetail', {
          good: formatNumber(count(good), locale),
          broken: formatNumber(count(broken), locale),
          name: product?.name ?? '',
        })}
        again={t('production.again')}
        onAgain={() => {
          setGood('');
          setBroken('');
          setStep(0);
          setSaved(false);
        }}
        home={t('backHome')}
      />
    );
  }

  return (
    <form method="post" onSubmit={form.onSubmit} noValidate>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="date" value={today} />
      <input type="hidden" name="goodQty" value={good} />
      <input type="hidden" name="defectiveQty" value={broken || '0'} />

      {current === 'product' && (
        <TaskFrame title={title} step={step} steps={steps.length} question={t('production.which')}>
          {products.map((option) => (
            <BigChoice
              key={option.id}
              title={option.name}
              detail={option.size}
              selected={option.id === productId}
              onClick={() => {
                setProductId(option.id);
                next();
              }}
            />
          ))}
        </TaskFrame>
      )}

      {current === 'good' && (
        <TaskFrame
          title={title}
          step={step}
          steps={steps.length}
          question={t('production.howManyGood')}
          onBack={back}
          footer={
            <Button type="button" size="lg" full disabled={count(good) === 0} onClick={next}>
              {t('next')}
            </Button>
          }
        >
          <NumberPad
            label={product ? t('production.goodOf', { name: product.name }) : t('production.good')}
            value={good}
            onChange={setGood}
            presets={presets}
            format={format}
          />
        </TaskFrame>
      )}

      {current === 'broken' && (
        <TaskFrame
          title={title}
          step={step}
          steps={steps.length}
          question={t('production.howManyBroken')}
          onBack={back}
          footer={
            <>
              <Button type="button" size="lg" full onClick={next}>
                {broken === '' || broken === '0' ? t('production.noneBroken') : t('next')}
              </Button>
            </>
          }
        >
          <NumberPad
            label={t('production.broken')}
            value={broken}
            onChange={setBroken}
            presets={[0, 50, 100, 200].map((value) => ({
              label: value === 0 ? t('production.none') : formatNumber(value, locale),
              value: value === 0 ? '' : String(value),
            }))}
            format={format}
          />
        </TaskFrame>
      )}

      {current === 'check' && (
        <TaskFrame
          title={title}
          step={step}
          steps={steps.length}
          question={t('checkAndSave')}
          onBack={back}
          footer={
            <Button type="submit" size="lg" full loading={form.pending} disabled={short.length > 0}>
              {form.pending ? t('saving') : t('save')}
            </Button>
          }
        >
          <FormErrors form={form} />
          <Summary>
            <SummaryRow label={t('production.brickType')} value={product?.name ?? ''} />
            <SummaryRow label={t('production.good')} value={format(good || '0')} strong />
            <SummaryRow label={t('production.broken')} value={format(broken || '0')} />
            <SummaryRow label={t('day')} value={t('today')} />
          </Summary>
          {usage.length > 0 && (
            <section className="border-border bg-surface rounded-xl border p-4">
              <h2 className="text-foreground-muted mb-2 text-sm font-medium">
                {t('production.materialUsed')}
              </h2>
              <ul className="flex flex-col gap-1.5">
                {usage.map((line) => (
                  <li key={line.materialId} className="flex justify-between gap-3">
                    <span className={line.short ? 'text-danger font-medium' : undefined}>
                      {line.short && <AlertTriangle aria-hidden className="mr-1 inline size-4" />}
                      {line.material?.materialName}
                    </span>
                    <span className="tabular-nums">
                      {formatQuantity(line.needMilli, locale)}{' '}
                      {line.material ? tc(`units.${line.material.unit}`) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {short.map((line) => {
            const unit = line.material ? tc(`units.${line.material.unit}`) : '';
            return (
              <Alert key={line.materialId} tone="danger">
                {tf('short', {
                  name: line.material?.materialName ?? '',
                  need: formatQuantity(line.needMilli, locale),
                  have: formatQuantity(line.availableMilli, locale),
                  unit,
                })}
              </Alert>
            );
          })}
          {short.length > 0 && <p className="text-foreground-muted">{t('production.short')}</p>}
        </TaskFrame>
      )}
    </form>
  );
}
