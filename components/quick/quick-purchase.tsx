'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { FormErrors } from '@/components/ui/form-errors';
import { Input } from '@/components/ui/input';
import { recordPurchaseAction } from '@/features/raw-materials/actions';
import { PurchaseSchema } from '@/features/raw-materials/schema';
import type { MaterialOption } from '@/features/raw-materials/types';
import { useActionForm } from '@/hooks/use-action-form';
import { formatMoney, parseRupees } from '@/lib/money';
import { formatQuantity } from '@/lib/quantity';
import { formatNumber } from '@/lib/utils';
import { BigChoice } from './big-choice';
import { DoneScreen } from './done-screen';
import { NumberPad } from './number-pad';
import { Summary, SummaryRow } from './summary';
import { TaskFrame } from './task-frame';

type Step = 'material' | 'qty' | 'cost' | 'check';
const STEPS: Step[] = ['material', 'qty', 'cost', 'check'];

/** "Material arrived": which material, how much, what the bill was, who sent it. */
export function QuickPurchase({
  materials,
  today,
}: {
  materials: MaterialOption[];
  today: string;
}) {
  const t = useTranslations('quick');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [step, setStep] = useState(0);
  const [materialId, setMaterialId] = useState('');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [saved, setSaved] = useState(false);

  const form = useActionForm(recordPurchaseAction, () => setSaved(true), {
    schema: PurchaseSchema,
  });

  const material = materials.find((option) => option.id === materialId);
  const unit = material ? tc(`units.${material.unit}`) : '';
  const current = STEPS[step] ?? 'check';
  const next = () => setStep((value) => Math.min(value + 1, STEPS.length - 1));
  const back = () => setStep((value) => Math.max(value - 1, 0));
  const title = t('tasks.purchase.title');
  const decimalsFor = (option: MaterialOption | undefined) =>
    option && (option.unit === 'tonne' || option.unit === 'litre') ? 2 : 0;
  const showNumber = (value: string) => {
    const [whole = '0', fraction] = value.split('.');
    return formatNumber(Number(whole), locale) + (fraction !== undefined ? `.${fraction}` : '');
  };

  if (materials.length === 0) {
    return (
      <TaskFrame title={title} step={0} steps={1} question={t('purchase.noMaterials')}>
        <Alert tone="info">{t('askAdmin')}</Alert>
      </TaskFrame>
    );
  }

  if (saved) {
    return (
      <DoneScreen
        title={t('purchase.done')}
        detail={t('purchase.doneDetail', {
          qty: showNumber(qty),
          unit,
          name: material?.name ?? '',
        })}
        again={t('purchase.again')}
        onAgain={() => {
          setStep(0);
          setMaterialId('');
          setQty('');
          setCost('');
          setSupplier('');
          setSaved(false);
        }}
        home={t('backHome')}
      />
    );
  }

  return (
    <form method="post" onSubmit={form.onSubmit} noValidate>
      <input type="hidden" name="materialId" value={materialId} />
      <input type="hidden" name="qtyMilli" value={qty} />
      <input type="hidden" name="costPaise" value={cost} />
      <input type="hidden" name="date" value={today} />
      {current !== 'check' && <input type="hidden" name="supplier" value={supplier} />}

      {current === 'material' && (
        <TaskFrame title={title} step={step} steps={STEPS.length} question={t('purchase.which')}>
          {materials.map((option) => (
            <BigChoice
              key={option.id}
              title={option.name}
              detail={t('purchase.inStock', {
                qty: formatQuantity(option.quantityMilli, locale),
                unit: tc(`units.${option.unit}`),
              })}
              selected={option.id === materialId}
              onClick={() => {
                setMaterialId(option.id);
                if (option.id !== materialId) setQty('');
                next();
              }}
            />
          ))}
        </TaskFrame>
      )}

      {current === 'qty' && (
        <TaskFrame
          title={title}
          step={step}
          steps={STEPS.length}
          question={t('purchase.howMuch', { name: material?.name ?? '' })}
          onBack={back}
          footer={
            <Button type="button" size="lg" full disabled={!(Number(qty) > 0)} onClick={next}>
              {t('next')}
            </Button>
          }
        >
          <NumberPad
            label={t('purchase.quantity')}
            value={qty}
            onChange={setQty}
            suffix={unit}
            decimals={decimalsFor(material)}
            format={showNumber}
          />
        </TaskFrame>
      )}

      {current === 'cost' && (
        <TaskFrame
          title={title}
          step={step}
          steps={STEPS.length}
          question={t('purchase.bill')}
          onBack={back}
          footer={
            <Button type="button" size="lg" full onClick={next}>
              {cost === '' ? t('purchase.noBill') : t('next')}
            </Button>
          }
        >
          <NumberPad
            label={t('purchase.billAmount')}
            value={cost}
            onChange={setCost}
            prefix="₹"
            format={showNumber}
          />
        </TaskFrame>
      )}

      {current === 'check' && (
        <TaskFrame
          title={title}
          step={step}
          steps={STEPS.length}
          question={t('checkAndSave')}
          onBack={back}
          footer={
            <Button type="submit" size="lg" full loading={form.pending}>
              {form.pending ? t('saving') : t('save')}
            </Button>
          }
        >
          <FormErrors form={form} />
          <Summary>
            <SummaryRow label={t('purchase.material')} value={material?.name ?? ''} />
            <SummaryRow
              label={t('purchase.quantity')}
              value={`${showNumber(qty)} ${unit}`}
              strong
            />
            <SummaryRow
              label={t('purchase.billAmount')}
              value={cost ? formatMoney(parseRupees(cost) ?? 0, locale) : t('purchase.noBillShort')}
            />
            <SummaryRow label={t('day')} value={t('today')} />
          </Summary>
          <Field label={t('purchase.supplier')}>
            {(props) => (
              <Input
                {...props}
                name="supplier"
                value={supplier}
                onChange={(event) => setSupplier(event.target.value)}
                placeholder={t('purchase.supplierHint')}
                autoComplete="off"
                className="min-h-14 text-lg"
              />
            )}
          </Field>
        </TaskFrame>
      )}
    </form>
  );
}
