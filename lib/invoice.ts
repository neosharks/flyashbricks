import type { OrganizationDoc } from '@/models/organization';
import type { InvoiceBuyer, InvoiceSeller } from '@/models/sale';
import {
  computeGst,
  financialYear,
  formatInvoiceNumber,
  stateFromGstin,
  type GstBreakdown,
} from './gst';

/** The seller block an invoice prints, frozen onto the sale when it is made. */
export function sellerSnapshot(org: OrganizationDoc): InvoiceSeller {
  const address = [org.address, org.city, org.pincode].filter(Boolean).join(', ') || null;
  const addressHi = org.addressHi
    ? [org.addressHi, org.city, org.pincode].filter(Boolean).join(', ')
    : null;
  return {
    name: org.legalName ?? org.name,
    nameHi: (org.legalName ? org.legalNameHi : org.nameHi) ?? null,
    address,
    addressHi,
    phone: org.phone,
    email: org.email,
    gstin: org.gstin,
    stateCode: org.stateCode ?? (org.gstin ? stateFromGstin(org.gstin) : null),
    hsnCode: org.hsnCode,
    bankAccountName: org.bank.accountName,
    bankAccountNumber: org.bank.accountNumber,
    bankIfsc: org.bank.ifsc,
    bankName: org.bank.bankName,
    upiId: org.upiId,
    terms: org.invoiceTerms,
  };
}

/**
 * Tax for a sale. No seller GSTIN means no GST at all, whatever rate is
 * configured. The buyer's state comes from their profile, then their GSTIN,
 * and otherwise is taken to be the seller's (a local sale).
 */
export function saleTax(
  seller: InvoiceSeller,
  buyer: InvoiceBuyer,
  taxablePaise: number,
  gstRateBps: number,
): GstBreakdown {
  const buyerState = buyer.stateCode ?? (buyer.gstin ? stateFromGstin(buyer.gstin) : null);
  return computeGst({
    taxablePaise,
    rateBps: seller.gstin ? gstRateBps : 0,
    sellerState: seller.stateCode,
    buyerState: buyerState ?? seller.stateCode,
  });
}

/** Counter name and printed number for the financial year the sale falls in. */
export function invoiceSequence(prefix: string, saleDate: Date) {
  const fy = financialYear(saleDate);
  return {
    counter: `invoice:${fy}`,
    format: (sequence: number) => formatInvoiceNumber(prefix, fy, sequence),
  };
}

/** "Tax Invoice" when GST is charged; otherwise a plain invoice (bill of supply). */
export function invoiceKind(seller: InvoiceSeller): 'tax_invoice' | 'invoice' {
  return seller.gstin ? 'tax_invoice' : 'invoice';
}
