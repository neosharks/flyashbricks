'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { FileText, Search, UserPlus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { AmountInput } from '@/components/ui/amount-input';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { FormErrors } from '@/components/ui/form-errors';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Spinner } from '@/components/ui/spinner';
import { searchCustomersAction } from '@/features/customers/actions';
import type { CustomerOption } from '@/features/customers/types';
import { createSaleAction } from '@/features/sales/actions';
import { CreateSaleSchema, foldLines } from '@/features/sales/schema';
import { computeSaleTotals } from '@/features/sales/totals';
import type { ProductOption } from '@/features/sales/types';
import { useActionForm } from '@/hooks/use-action-form';
import { computeGst, stateFromGstin, type StateCode } from '@/lib/gst';
import { formatMoney, paiseToInput, parseRupees } from '@/lib/money';
import { normalizePhone, formatPhone } from '@/lib/phone';
import { formatNumber } from '@/lib/utils';
import { BigChoice } from './big-choice';
import { DoneScreen } from './done-screen';
import { ModePicker, type Mode } from './mode-picker';
import { NumberPad } from './number-pad';
import { Summary, SummaryRow } from './summary';
import { TaskFrame } from './task-frame';

type Step = 'customer' | 'product' | 'qty' | 'money' | 'check';
type Paid = 'full' | 'part' | 'later';

type Props = {
  products: ProductOption[];
  today: string;
  org: { registered: boolean; gstRateBps: number; stateCode: StateCode | null };
};

/**
 * A sale, one question per screen: who is buying, which bricks, how many,
 * what was paid, then a last look before saving. Delivery, discount and the
 * other extras stay on the full sale form.
 */
export function QuickSale({ products, today, org }: Props) {
  const t = useTranslations('quick');
  const ts = useTranslations('sales');
  const locale = useLocale();
  const single = products.length === 1;
  const steps: Step[] = single
    ? ['customer', 'qty', 'money', 'check']
    : ['customer', 'product', 'qty', 'money', 'check'];

  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [newCustomer, setNewCustomer] = useState<{ name: string; phone: string } | null>(null);
  const [productId, setProductId] = useState(single ? (products[0]?.id ?? '') : '');
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState(
    single && products[0] ? paiseToInput(products[0].defaultRatePaise) : '',
  );
  const [editRate, setEditRate] = useState(false);
  const [paid, setPaid] = useState<Paid | null>(null);
  const [part, setPart] = useState('');
  const [mode, setMode] = useState<Mode>('cash');
  const [savedId, setSavedId] = useState<string | null>(null);

  const form = useActionForm(createSaleAction, (data) => setSavedId(data.id), {
    schema: CreateSaleSchema,
    prepare: foldLines,
  });

  const product = products.find((option) => option.id === productId);
  const bricks = qty === '' ? 0 : Number(qty);
  const ratePaise = parseRupees(rate) ?? 0;
  const totalPaise = useMemo(() => {
    const result = computeSaleTotals({
      lines: [{ qty: bricks, ratePaise }],
      deliveryPaise: 0,
      discountPaise: 0,
    });
    if (!result.ok) return 0;
    const buyerState =
      customer?.stateCode ?? (customer?.gstin ? stateFromGstin(customer.gstin) : null);
    return computeGst({
      taxablePaise: result.totals.totalPaise,
      rateBps: org.registered ? org.gstRateBps : 0,
      sellerState: org.stateCode,
      buyerState: buyerState ?? org.stateCode,
    }).totalPaise;
  }, [bricks, ratePaise, customer, org]);
  const paidPaise = paid === 'full' ? totalPaise : paid === 'part' ? (parseRupees(part) ?? 0) : 0;
  const duePaise = Math.max(0, totalPaise - paidPaise);

  const money = (paise: number) => formatMoney(paise, locale);
  const current = steps[step] ?? 'check';
  const next = () => setStep((value) => Math.min(value + 1, steps.length - 1));
  const back = () => setStep((value) => Math.max(value - 1, 0));
  const title = t('tasks.sale.title');
  const buyerName = customer?.name ?? newCustomer?.name ?? '';
  const newReady =
    newCustomer !== null &&
    newCustomer.name.trim().length >= 2 &&
    normalizePhone(newCustomer.phone) !== null;

  function reset(): void {
    setStep(0);
    setCustomer(null);
    setNewCustomer(null);
    setQty('');
    setPaid(null);
    setPart('');
    setSavedId(null);
    if (!single) setProductId('');
  }

  if (products.length === 0) {
    return (
      <TaskFrame title={title} step={0} steps={1} question={t('sale.noProducts')}>
        <Alert tone="info">{t('askAdmin')}</Alert>
      </TaskFrame>
    );
  }

  if (savedId) {
    return (
      <DoneScreen
        title={t('sale.done')}
        detail={t('sale.doneDetail', {
          bricks: formatNumber(bricks, locale),
          name: buyerName,
          total: money(totalPaise),
        })}
        again={t('sale.again')}
        onAgain={reset}
        home={t('backHome')}
        extra={
          <Button asChild size="lg" variant="outline" full>
            <Link href={`/sales/${savedId}/invoice`}>
              <FileText aria-hidden />
              {t('sale.openBill')}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <form method="post" onSubmit={form.onSubmit} noValidate>
      <input type="hidden" name="customerMode" value={newCustomer ? 'new' : 'existing'} />
      <input type="hidden" name="customerId" value={customer?.id ?? ''} />
      {newCustomer && (
        <>
          <input type="hidden" name="newCustomerName" value={newCustomer.name} />
          <input type="hidden" name="newCustomerPhone" value={newCustomer.phone} />
        </>
      )}
      <input type="hidden" name="date" value={today} />
      <input type="hidden" name="lines.0.productId" value={productId} />
      <input type="hidden" name="lines.0.qty" value={qty} />
      <input type="hidden" name="lines.0.rate" value={rate} />
      <input
        type="hidden"
        name="paymentAmount"
        value={paidPaise > 0 ? paiseToInput(paidPaise) : ''}
      />
      <input type="hidden" name="paymentMode" value={mode} />

      {current === 'customer' && (
        <TaskFrame
          title={title}
          step={step}
          steps={steps.length}
          question={t('sale.who')}
          footer={
            newCustomer ? (
              <Button type="button" size="lg" full disabled={!newReady} onClick={next}>
                {t('next')}
              </Button>
            ) : undefined
          }
        >
          {newCustomer ? (
            <NewCustomer
              value={newCustomer}
              onChange={setNewCustomer}
              onCancel={() => setNewCustomer(null)}
            />
          ) : (
            <CustomerList
              selected={customer}
              onPick={(picked) => {
                setCustomer(picked);
                next();
              }}
              onNew={() => {
                setCustomer(null);
                setNewCustomer({ name: '', phone: '' });
              }}
            />
          )}
        </TaskFrame>
      )}

      {current === 'product' && (
        <TaskFrame
          title={title}
          step={step}
          steps={steps.length}
          question={t('sale.which')}
          onBack={back}
        >
          {products.map((option) => (
            <BigChoice
              key={option.id}
              title={option.name}
              detail={t('sale.inYard', { count: formatNumber(option.stockGood, locale) })}
              trailing={t('sale.perBrick', { rate: money(option.defaultRatePaise) })}
              selected={option.id === productId}
              onClick={() => {
                setProductId(option.id);
                setRate(paiseToInput(option.defaultRatePaise));
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
          steps={steps.length}
          question={t('sale.howMany')}
          onBack={back}
          footer={
            <Button
              type="button"
              size="lg"
              full
              disabled={
                bricks === 0 ||
                ratePaise === 0 ||
                (product !== undefined && bricks > product.stockGood)
              }
              onClick={next}
            >
              {t('next')}
            </Button>
          }
        >
          <NumberPad
            label={t('sale.bricks')}
            value={qty}
            onChange={setQty}
            presets={[1000, 2000, 3000, 4000, 5000].map((value) => ({
              label: formatNumber(value, locale),
              value: String(value),
            }))}
            format={(value) => formatNumber(Number(value), locale)}
            hint={
              product
                ? t('sale.inYard', { count: formatNumber(product.stockGood, locale) })
                : undefined
            }
            error={product && bricks > product.stockGood ? t('sale.notEnough') : undefined}
          />
          <div className="border-border bg-surface flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
            {editRate ? (
              <Field label={t('sale.rate')} className="flex-1">
                {(props) => (
                  <AmountInput
                    {...props}
                    prefix="₹"
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                    className="text-lg"
                  />
                )}
              </Field>
            ) : (
              <>
                <span>
                  <span className="text-foreground-muted block text-sm">{t('sale.rate')}</span>
                  <span className="text-lg font-semibold tabular-nums">{money(ratePaise)}</span>
                </span>
                <Button type="button" variant="outline" onClick={() => setEditRate(true)}>
                  {t('sale.changeRate')}
                </Button>
              </>
            )}
          </div>
        </TaskFrame>
      )}

      {current === 'money' && (
        <TaskFrame
          title={title}
          step={step}
          steps={steps.length}
          question={t('sale.paidHowMuch', { total: money(totalPaise) })}
          onBack={back}
          footer={
            <Button
              type="button"
              size="lg"
              full
              disabled={
                paid === null || (paid === 'part' && (paidPaise <= 0 || paidPaise >= totalPaise))
              }
              onClick={next}
            >
              {t('next')}
            </Button>
          }
        >
          <BigChoice
            title={t('sale.paidFull')}
            detail={money(totalPaise)}
            selected={paid === 'full'}
            onClick={() => setPaid('full')}
          />
          <BigChoice
            title={t('sale.paidPart')}
            detail={t('sale.paidPartHint')}
            selected={paid === 'part'}
            onClick={() => setPaid('part')}
          />
          <BigChoice
            title={t('sale.paidLater')}
            detail={t('sale.paidLaterHint', { total: money(totalPaise) })}
            selected={paid === 'later'}
            onClick={() => setPaid('later')}
          />

          {paid === 'part' && (
            <NumberPad
              label={t('sale.amountPaid')}
              value={part}
              onChange={setPart}
              prefix="₹"
              format={(value) => formatNumber(Number(value), locale)}
              hint={t('sale.stillDue', { due: money(duePaise) })}
              error={paidPaise >= totalPaise ? t('sale.partTooMuch') : undefined}
            />
          )}
          {paidPaise > 0 && <ModePicker value={mode} onChange={setMode} label={t('sale.how')} />}
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
            <Button type="submit" size="lg" full loading={form.pending}>
              {form.pending ? t('saving') : t('sale.save')}
            </Button>
          }
        >
          <FormErrors form={form} />
          <Summary>
            <SummaryRow label={t('sale.customer')} value={buyerName} />
            <SummaryRow
              label={product?.name ?? t('sale.bricks')}
              value={`${formatNumber(bricks, locale)} × ${money(ratePaise)}`}
            />
            <SummaryRow label={t('sale.total')} value={money(totalPaise)} strong />
            <SummaryRow
              label={t('sale.received')}
              value={paidPaise > 0 ? `${money(paidPaise)} · ${ts(`modes.${mode}`)}` : money(0)}
              tone="success"
            />
            <SummaryRow
              label={t('sale.due')}
              value={money(duePaise)}
              tone={duePaise > 0 ? 'danger' : undefined}
            />
            <SummaryRow label={t('day')} value={t('today')} />
          </Summary>
        </TaskFrame>
      )}
    </form>
  );
}

function CustomerList({
  selected,
  onPick,
  onNew,
}: {
  selected: CustomerOption | null;
  onPick: (customer: CustomerOption) => void;
  onNew: () => void;
}) {
  const t = useTranslations('quick.sale');
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(text: string): void {
    startTransition(async () => {
      const result = await searchCustomersAction(text);
      if (result.ok) setResults(result.data);
    });
  }

  // Recent buyers before anything is typed: a regular is one tap.
  useEffect(() => {
    search('');
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <>
      <BigChoice
        title={t('newCustomer')}
        detail={t('newCustomerHint')}
        tone="muted"
        icon={<UserPlus aria-hidden className="size-6" />}
        onClick={onNew}
      />
      <div className="relative">
        <span className="text-foreground-muted pointer-events-none absolute inset-y-0 left-3 flex items-center">
          {pending ? <Spinner label={t('searching')} /> : <Search aria-hidden className="size-5" />}
        </span>
        <Input
          type="search"
          aria-label={t('search')}
          placeholder={t('search')}
          value={query}
          autoComplete="off"
          className="min-h-14 pl-10 text-lg"
          onChange={(event) => {
            const text = event.target.value;
            setQuery(text);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => search(text), 300);
          }}
        />
      </div>
      {!query && results.length > 0 && (
        <p className="text-foreground-muted text-sm">{t('recent')}</p>
      )}
      {query && !pending && results.length === 0 && (
        <p className="text-foreground-muted">{t('noMatches')}</p>
      )}
      {results.map((customer) => (
        <BigChoice
          key={customer.id}
          title={customer.name}
          detail={`${formatPhone(customer.phone)}${customer.city ? ` · ${customer.city}` : ''}`}
          trailing={
            customer.duePaise > 0 ? (
              <span className="text-danger">
                {t('owes', { amount: formatMoney(customer.duePaise, locale) })}
              </span>
            ) : undefined
          }
          selected={selected?.id === customer.id}
          onClick={() => onPick(customer)}
        />
      ))}
    </>
  );
}

function NewCustomer({
  value,
  onChange,
  onCancel,
}: {
  value: { name: string; phone: string };
  onChange: (value: { name: string; phone: string }) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('quick.sale');
  return (
    <div className="flex flex-col gap-4">
      <Field label={t('newName')} required>
        {(props) => (
          <Input
            {...props}
            value={value.name}
            onChange={(event) => onChange({ ...value, name: event.target.value })}
            autoComplete="off"
            className="min-h-14 text-lg"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the screen was opened to type this name
            autoFocus
          />
        )}
      </Field>
      <Field label={t('newPhone')} required>
        {(props) => (
          <PhoneInput
            {...props}
            value={value.phone}
            onChange={(event) => onChange({ ...value, phone: event.target.value })}
            className="min-h-14 text-lg"
          />
        )}
      </Field>
      <Button type="button" variant="ghost" onClick={onCancel} className="self-start">
        {t('pickExisting')}
      </Button>
    </div>
  );
}
