import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { PrintButton } from '@/components/sales/print-button';
import { getSale } from '@/features/sales/queries';
import { amountInWords } from '@/lib/amount-in-words';
import { GST_STATES } from '@/lib/gst';
import { invoiceKind } from '@/lib/invoice';
import { formatMoney } from '@/lib/money';
import { formatPhone } from '@/lib/phone';
import { requirePermissionPage } from '@/lib/session';
import { formatDate, formatNumber, formatPercent } from '@/lib/utils';
import { Page } from '@/components/ui/page';

export const metadata: Metadata = { title: 'Invoice' };

/**
 * Printing shows only the invoice sheet. The app chrome (sidebar, header, tab
 * bar) is hidden by visibility rather than by touching the layout, so this
 * page needs nothing from it.
 */
const PRINT_CSS = `
@page { size: A4; margin: 12mm; }
@media print {
  html, body { background: #fff !important; }
  body * { visibility: hidden; }
  #invoice, #invoice * { visibility: visible; }
  #invoice { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; padding: 0 !important; color: #000; }
}`;

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requirePermissionPage(`/sales/${id}/invoice`, 'sales:read');
  const [sale, t, locale] = await Promise.all([
    getSale(viewer, id),
    getTranslations('sales.invoice'),
    getLocale(),
  ]);
  if (!sale) notFound();

  const money = (paise: number) => formatMoney(paise, locale);
  const { seller, buyer } = sale;
  const taxInvoice = invoiceKind(seller) === 'tax_invoice';
  const half = formatPercent(sale.gstRateBps / 20_000, locale);
  const full = formatPercent(sale.gstRateBps / 10_000, locale);
  const buyerState = buyer.stateCode ?? seller.stateCode;
  const hasBank = Boolean(seller.bankAccountNumber ?? seller.upiId);

  return (
    <Page size="medium">
      <style>{PRINT_CSS}</style>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Link
          href={`/sales/${sale.id}`}
          className="text-foreground-muted hover:text-foreground inline-flex min-h-11 items-center gap-1 text-sm"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {t('back')}
        </Link>
        <PrintButton label={t('print')} />
      </div>

      <article
        id="invoice"
        aria-label={sale.invoiceNumber}
        className="border-border relative mx-auto max-w-[210mm] overflow-hidden rounded-lg border bg-white p-6 text-[13px] leading-snug text-neutral-900 shadow-sm sm:p-10"
      >
        {sale.voided && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="-rotate-30 rounded-lg border-8 border-red-600/40 px-8 py-2 text-7xl font-black tracking-widest text-red-600/40">
              {t('cancelled')}
            </span>
          </div>
        )}

        <header className="flex flex-col gap-4 border-b-2 border-neutral-900 pb-4 sm:flex-row sm:justify-between">
          <div>
            <p className="text-xl font-bold">{seller.name}</p>
            {seller.nameHi && (
              <p lang="hi" className="text-sm font-semibold text-neutral-700">
                {seller.nameHi}
              </p>
            )}
            {seller.address && <p className="max-w-80 text-neutral-700">{seller.address}</p>}
            {seller.addressHi && (
              <p lang="hi" className="max-w-80 text-xs text-neutral-600">
                {seller.addressHi}
              </p>
            )}
            {seller.stateCode && (
              <p className="text-neutral-700">
                {t('state')}: {GST_STATES[seller.stateCode]} ({seller.stateCode})
              </p>
            )}
            <p className="text-neutral-700">
              {[seller.phone ? formatPhone(seller.phone) : null, seller.email]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {seller.gstin && (
              <p className="font-semibold">
                GSTIN: <span className="font-mono">{seller.gstin}</span>
              </p>
            )}
          </div>
          <div className="sm:text-right">
            <h1 className="text-lg font-bold tracking-wide uppercase">
              {taxInvoice ? t('taxInvoice') : t('plainInvoice')}
            </h1>
            <p>
              {t('number')}: <span className="font-mono font-semibold">{sale.invoiceNumber}</span>
            </p>
            <p>
              {t('date')}: {formatDate(sale.date, locale)}
            </p>
            {sale.vehicleNo && (
              <p>
                {t('vehicle')}: {sale.vehicleNo}
              </p>
            )}
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 border-b border-neutral-300 py-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase">{t('billTo')}</p>
            <p className="text-base font-semibold">{buyer.name}</p>
            {buyer.nameHi && (
              <p lang="hi" className="text-xs font-medium text-neutral-600">
                {buyer.nameHi}
              </p>
            )}
            {buyer.address && <p className="text-neutral-700">{buyer.address}</p>}
            {buyer.addressHi && (
              <p lang="hi" className="text-xs text-neutral-600">
                {buyer.addressHi}
              </p>
            )}
            <p className="text-neutral-700 tabular-nums">{formatPhone(buyer.phone)}</p>
            {buyer.gstin && (
              <p>
                GSTIN: <span className="font-mono">{buyer.gstin}</span>
              </p>
            )}
          </div>
          {taxInvoice && buyerState && (
            <div className="sm:text-right">
              <p className="text-xs font-semibold text-neutral-500 uppercase">
                {t('placeOfSupply')}
              </p>
              <p>
                {GST_STATES[buyerState]} ({buyerState})
              </p>
            </div>
          )}
        </section>

        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr className="border-y border-neutral-900 text-left text-xs uppercase">
              <th scope="col" className="py-2 pr-2">
                #
              </th>
              <th scope="col" className="py-2 pr-2">
                {t('description')}
              </th>
              {seller.hsnCode && (
                <th scope="col" className="py-2 pr-2">
                  HSN
                </th>
              )}
              <th scope="col" className="py-2 pr-2 text-right">
                {t('qty')}
              </th>
              <th scope="col" className="py-2 pr-2 text-right">
                {t('rate')}
              </th>
              <th scope="col" className="py-2 text-right">
                {t('amount')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((line, index) => (
              <tr key={line.productId} className="border-b border-neutral-200 align-top">
                <td className="py-2 pr-2">{index + 1}</td>
                <td className="py-2 pr-2">
                  {line.productNameEn}
                  {line.productNameHi && (
                    <span lang="hi" className="block text-xs text-neutral-600">
                      {line.productNameHi}
                    </span>
                  )}
                </td>
                {seller.hsnCode && <td className="py-2 pr-2 font-mono">{seller.hsnCode}</td>}
                <td className="py-2 pr-2 text-right tabular-nums">
                  {formatNumber(line.qty, locale)}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">{money(line.ratePaise)}</td>
                <td className="py-2 text-right tabular-nums">{money(line.amountPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <p className="text-xs font-semibold text-neutral-500 uppercase">{t('inWords')}</p>
            <p className="font-medium">
              {amountInWords(sale.totalPaise, locale === 'hi' ? 'hi' : 'en')}
            </p>
          </div>
          <dl className="w-full max-w-72 text-sm">
            <Row label={t('subtotal')} value={money(sale.subtotalPaise)} />
            {sale.deliveryPaise > 0 && (
              <Row label={t('delivery')} value={money(sale.deliveryPaise)} />
            )}
            {sale.discountPaise > 0 && (
              <Row label={t('discount')} value={`− ${money(sale.discountPaise)}`} />
            )}
            {taxInvoice && <Row label={t('taxable')} value={money(sale.taxablePaise)} />}
            {sale.cgstPaise > 0 && (
              <Row label={t('cgst', { rate: half })} value={money(sale.cgstPaise)} />
            )}
            {sale.sgstPaise > 0 && (
              <Row label={t('sgst', { rate: half })} value={money(sale.sgstPaise)} />
            )}
            {sale.igstPaise > 0 && (
              <Row label={t('igst', { rate: full })} value={money(sale.igstPaise)} />
            )}
            <div className="mt-1 flex justify-between border-y-2 border-neutral-900 py-2 text-base font-bold">
              <dt>{t('grandTotal')}</dt>
              <dd className="tabular-nums">{money(sale.totalPaise)}</dd>
            </div>
            {!sale.voided && sale.paidPaise > 0 && (
              <Row label={t('received')} value={money(sale.paidPaise)} />
            )}
            {!sale.voided && sale.duePaise > 0 && (
              <Row label={t('balance')} value={money(sale.duePaise)} strong />
            )}
          </dl>
        </div>

        <footer className="mt-8 grid grid-cols-1 gap-6 border-t border-neutral-300 pt-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            {hasBank && (
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase">{t('bank')}</p>
                {seller.bankAccountName && <p>{seller.bankAccountName}</p>}
                {seller.bankName && <p>{seller.bankName}</p>}
                {seller.bankAccountNumber && (
                  <p>
                    {t('account')}: <span className="font-mono">{seller.bankAccountNumber}</span>
                  </p>
                )}
                {seller.bankIfsc && (
                  <p>
                    IFSC: <span className="font-mono">{seller.bankIfsc}</span>
                  </p>
                )}
                {seller.upiId && (
                  <p>
                    UPI: <span className="font-mono">{seller.upiId}</span>
                  </p>
                )}
              </div>
            )}
            {seller.terms && (
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase">{t('terms')}</p>
                <p className="whitespace-pre-line text-neutral-700">{seller.terms}</p>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end justify-end gap-12 text-right">
            <p>{t('forCompany', { name: seller.name })}</p>
            <p className="w-48 border-t border-neutral-900 pt-1 text-xs">{t('signature')}</p>
          </div>
        </footer>
        <p className="mt-6 text-center text-xs text-neutral-500">{t('computerGenerated')}</p>
      </article>
    </Page>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={
        strong ? 'flex justify-between py-0.5 font-semibold' : 'flex justify-between py-0.5'
      }
    >
      <dt className="text-neutral-600">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
