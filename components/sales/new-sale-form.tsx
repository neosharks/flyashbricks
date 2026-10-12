'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ChevronDown, Plus, Save, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { AmountInput } from '@/components/ui/amount-input';
import { RateComparison } from './rate-comparison';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { createSaleAction } from '@/features/sales/actions';
import type { CustomerOption } from '@/features/customers/types';
import type { ProductOption } from '@/features/sales/types';
import { computeSaleTotals } from '@/features/sales/totals';
import { useActionForm } from '@/hooks/use-action-form';
import { computeGst, stateFromGstin, type StateCode } from '@/lib/gst';
import { formatMoney, paiseToInput, parseRupees } from '@/lib/money';
import { LIMITS, PAYMENT_MODES, type PaymentMode } from '@/models/constants';
import { cn, formatNumber } from '@/lib/utils';
import { CustomerPicker } from './customer-picker';

type Line = { key: number; productId: string; qty: string; rate: string };

type NewSaleFormProps = {
  products: ProductOption[];
  today: string;
  initialCustomer: CustomerOption | null;
  org: { registered: boolean; gstRateBps: number; stateCode: StateCode | null };
};

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-surface rounded-xl border p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-3 text-base font-semibold">
        <span
          aria-hidden
          className="bg-action text-action-foreground flex size-7 items-center justify-center rounded-full text-sm"
        >
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

const toInt = (text: string): number => {
  const cleaned = text.replace(/[,\s]/g, '');
  return /^\d{1,9}$/.test(cleaned) ? Number(cleaned) : 0;
};

/**
 * A sale in three steps: who is buying, how many bricks, and how much money
 * came in now. Everything else (date, delivery, discount, vehicle, note) sits
 * behind "More options" with sensible defaults. The totals shown here are a
 * preview; the server recomputes every figure.
 */
export function NewSaleForm({ products, today, initialCustomer, org }: NewSaleFormProps) {
  const t = useTranslations('sales.form');
  const ts = useTranslations('sales');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();

  const single = products.length === 1 ? products[0] : undefined;
  const [lines, setLines] = useState<Line[]>([
    {
      key: 0,
      productId: single?.id ?? '',
      qty: '',
      rate: single ? paiseToInput(single.defaultRatePaise) : '',
    },
  ]);
  const [nextKey, setNextKey] = useState(1);
  const [customer, setCustomer] = useState<CustomerOption | null>(initialCustomer);
  const [more, setMore] = useState(false);
  const [delivery, setDelivery] = useState('');
  const [discount, setDiscount] = useState('');
  const [payment, setPayment] = useState('');
  const [mode, setMode] = useState<PaymentMode>('cash');

  const form = useActionForm(createSaleAction, (data) => {
    toast.success(ts('created'));
    router.push(`/sales/${data.id}`);
  });

  const byId = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const preview = useMemo(() => {
    const result = computeSaleTotals({
      lines: lines.map((line) => ({
        qty: toInt(line.qty),
        ratePaise: parseRupees(line.rate) ?? 0,
      })),
      deliveryPaise: parseRupees(delivery) ?? 0,
      discountPaise: parseRupees(discount) ?? 0,
    });
    if (!result.ok) return null;
    const buyerState =
      customer?.stateCode ?? (customer?.gstin ? stateFromGstin(customer.gstin) : null);
    const gst = computeGst({
      taxablePaise: result.totals.totalPaise,
      rateBps: org.registered ? org.gstRateBps : 0,
      sellerState: org.stateCode,
      buyerState: buyerState ?? org.stateCode,
    });
    return { ...result.totals, gst };
  }, [lines, delivery, discount, customer, org]);

  const update = (key: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const money = (paise: number) => formatMoney(paise, locale);
  const total = preview?.gst.totalPaise ?? 0;
  const balance = Math.max(0, total - (parseRupees(payment) ?? 0));
  const usedProducts = new Set(lines.map((line) => line.productId));

  if (products.length === 0) return <Alert tone="info">{t('noProducts')}</Alert>;

  return (
    <form
      method="post"
      onSubmit={form.onSubmit}
      className="flex flex-col gap-4 pb-28 lg:pb-0"
      noValidate
    >
      {form.formError && <Alert tone="danger">{form.formError}</Alert>}

      <Step number={1} title={t('customer')}>
        <CustomerPicker
          initial={initialCustomer}
          error={form.error}
          onChange={(next) => setCustomer(next)}
        />
      </Step>

      <Step number={2} title={t('lines')}>
        <ol className="flex flex-col gap-4">
          {lines.map((line, index) => {
            const product = byId.get(line.productId);
            const qty = toInt(line.qty);
            const short = product !== undefined && qty > product.stockGood;
            return (
              <li
                key={line.key}
                className={cn('flex flex-col gap-3', index > 0 && 'border-border border-t pt-4')}
              >
                {lines.length > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-foreground-muted text-sm">
                      {t('line', { index: index + 1 })}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger-subtle"
                      aria-label={t('removeLine', { index: index + 1 })}
                      onClick={() =>
                        setLines((current) => current.filter((item) => item.key !== line.key))
                      }
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                )}

                <Field label={t('product')} required error={form.error(`lines.${index}.productId`)}>
                  {(props) => (
                    <Select
                      {...props}
                      name={`lines.${index}.productId`}
                      value={line.productId}
                      onChange={(event) => {
                        const chosen = byId.get(event.target.value);
                        update(line.key, {
                          productId: event.target.value,
                          ...(chosen ? { rate: paiseToInput(chosen.defaultRatePaise) } : {}),
                        });
                      }}
                      required
                    >
                      <option value="">{t('chooseProduct')}</option>
                      {products.map((option) => (
                        <option
                          key={option.id}
                          value={option.id}
                          disabled={option.id !== line.productId && usedProducts.has(option.id)}
                        >
                          {option.name}
                          {option.size ? ` (${option.size})` : ''} —{' '}
                          {t('inStock', { count: formatNumber(option.stockGood, locale) })}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label={t('qty')}
                    required
                    hint={
                      product
                        ? t('inStock', { count: formatNumber(product.stockGood, locale) })
                        : undefined
                    }
                    error={form.error(`lines.${index}.qty`)}
                  >
                    {(props) => (
                      <AmountInput
                        {...props}
                        name={`lines.${index}.qty`}
                        inputMode="numeric"
                        value={line.qty}
                        onChange={(event) => update(line.key, { qty: event.target.value })}
                        className={cn('text-lg font-semibold', short && 'border-danger')}
                        required
                      />
                    )}
                  </Field>
                  <Field label={t('rate')} required error={form.error(`lines.${index}.rate`)}>
                    {(props) => (
                      <AmountInput
                        {...props}
                        name={`lines.${index}.rate`}
                        prefix="₹"
                        value={line.rate}
                        onChange={(event) => update(line.key, { rate: event.target.value })}
                        className="text-lg"
                        required
                      />
                    )}
                  </Field>
                </div>

                {product && parseRupees(line.rate) !== null && (
                  <RateComparison
                    ratePaise={parseRupees(line.rate) ?? 0}
                    defaultRatePaise={product.defaultRatePaise}
                    variant="form"
                  />
                )}

                {qty > 0 && (
                  <p className="text-foreground-muted text-right text-sm tabular-nums">
                    {t('lineMath', {
                      qty: formatNumber(qty, locale),
                      rate: money(parseRupees(line.rate) ?? 0),
                    })}{' '}
                    <span className="text-foreground font-semibold">
                      {money(qty * (parseRupees(line.rate) ?? 0))}
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        {lines.length < Math.min(LIMITS.linesPerSale, products.length) && (
          <Button
            type="button"
            variant="ghost"
            className="mt-2"
            onClick={() => {
              setLines((current) => [
                ...current,
                { key: nextKey, productId: '', qty: '', rate: '' },
              ]);
              setNextKey((key) => key + 1);
            }}
          >
            <Plus aria-hidden />
            {t('addLine')}
          </Button>
        )}
        {form.error('lines') && (
          <p className="text-danger mt-2 text-xs font-medium">{form.error('lines')}</p>
        )}
      </Step>

      <Step number={3} title={t('payment')}>
        <div className="flex flex-col gap-4">
          <Field
            label={t('paymentAmount')}
            hint={t('paymentHint')}
            error={form.error('paymentAmount')}
          >
            {(props) => (
              <div className="flex gap-2">
                <div className="flex-1">
                  <AmountInput
                    {...props}
                    name="paymentAmount"
                    prefix="₹"
                    value={payment}
                    onChange={(event) => setPayment(event.target.value)}
                    className="text-lg"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={total === 0}
                  onClick={() => setPayment(paiseToInput(total))}
                >
                  {t('payFull')}
                </Button>
              </div>
            )}
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('paymentMode')}</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
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
                    name="paymentMode"
                    value={option}
                    checked={mode === option}
                    onChange={() => setMode(option)}
                    className="sr-only"
                  />
                  {ts(`modes.${option}`)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Step>

      <section className="border-border bg-surface rounded-xl border">
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore((open) => !open)}
          className="flex min-h-12 w-full items-center justify-between px-4 text-sm font-medium sm:px-5"
        >
          {t('extras')}
          <ChevronDown
            aria-hidden
            className={cn('size-4 transition-transform', more && 'rotate-180')}
          />
        </button>
        {/* Kept mounted when closed so typed values still submit. */}
        <div
          className={cn(
            'grid grid-cols-1 gap-4 px-4 pb-4 sm:grid-cols-2 sm:px-5 sm:pb-5',
            !more && 'hidden',
          )}
        >
          <Field label={t('date')} required error={form.error('date')}>
            {(props) => (
              <Input {...props} type="date" name="date" defaultValue={today} max={today} required />
            )}
          </Field>
          <Field label={t('vehicleNo')} error={form.error('vehicleNo')}>
            {(props) => (
              <Input
                {...props}
                name="vehicleNo"
                placeholder={t('vehiclePlaceholder')}
                className="uppercase"
                autoCapitalize="characters"
              />
            )}
          </Field>
          <Field label={t('delivery')} error={form.error('delivery')}>
            {(props) => (
              <AmountInput
                {...props}
                name="delivery"
                prefix="₹"
                value={delivery}
                onChange={(event) => setDelivery(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('discount')} error={form.error('discount')}>
            {(props) => (
              <AmountInput
                {...props}
                name="discount"
                prefix="₹"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
              />
            )}
          </Field>
          <Field
            label={t('deliveryAddress')}
            error={form.error('deliveryAddress')}
            className="sm:col-span-2"
          >
            {(props) => (
              <Textarea {...props} name="deliveryAddress" rows={2} className="min-h-16" />
            )}
          </Field>
          <Field label={t('note')} error={form.error('note')} className="sm:col-span-2">
            {(props) => <Textarea {...props} name="note" rows={2} className="min-h-16" />}
          </Field>
        </div>
      </section>

      {/* Totals and the one primary action; pinned above the tab bar on a phone. */}
      <div className="border-border bg-surface/95 fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t p-3 backdrop-blur lg:static lg:rounded-xl lg:border lg:p-5">
        <dl className="mb-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
          {preview && preview.gst.taxPaise > 0 && (
            <div className="flex gap-1.5">
              <dt className="text-foreground-muted">GST</dt>
              <dd className="tabular-nums">{money(preview.gst.taxPaise)}</dd>
            </div>
          )}
          <div className="flex gap-1.5">
            <dt className="text-foreground-muted">{t('total')}</dt>
            <dd className="text-lg font-semibold tabular-nums">{money(total)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-foreground-muted">{t('balance')}</dt>
            <dd
              className={cn(
                'text-lg font-semibold tabular-nums',
                balance > 0 ? 'text-danger' : 'text-success',
              )}
            >
              {money(balance)}
            </dd>
          </div>
        </dl>
        <Button type="submit" size="lg" full loading={form.pending}>
          {!form.pending && <Save aria-hidden />}
          {form.pending ? t('saving') : t('save')}
        </Button>
        {preview === null && <p className="text-danger mt-2 text-xs">{tc('errorTitle')}</p>}
      </div>
    </form>
  );
}
