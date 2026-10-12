import 'server-only';
import { connectDb } from '@/lib/db';
import type { SessionUser } from '@/lib/permissions';
import { DEFAULT_STATE_CODE } from '@/lib/gst';
import { Organization, type OrganizationDoc } from '@/models/organization';

export async function getOrganization(viewer: SessionUser): Promise<OrganizationDoc | null> {
  await connectDb();
  return Organization.findById(viewer.orgId).lean();
}

/** Plain values for the settings form; every field is a string the inputs can show. */
export type BusinessSettingsValues = {
  name: string;
  nameHi: string;
  legalName: string;
  legalNameHi: string;
  address: string;
  addressHi: string;
  city: string;
  pincode: string;
  stateCode: string;
  phone: string;
  email: string;
  gstRegistered: boolean;
  gstin: string;
  gstRateBps: number;
  hsnCode: string;
  invoicePrefix: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
  upiId: string;
  invoiceTerms: string;
};

export function toSettingsValues(org: OrganizationDoc): BusinessSettingsValues {
  return {
    name: org.name,
    nameHi: org.nameHi ?? '',
    legalName: org.legalName ?? '',
    legalNameHi: org.legalNameHi ?? '',
    address: org.address ?? '',
    addressHi: org.addressHi ?? '',
    city: org.city ?? '',
    pincode: org.pincode ?? '',
    stateCode: org.stateCode ?? DEFAULT_STATE_CODE,
    phone: org.phone ?? '',
    email: org.email ?? '',
    gstRegistered: org.gstin !== null,
    gstin: org.gstin ?? '',
    gstRateBps: org.gstRateBps || 500,
    hsnCode: org.hsnCode ?? '',
    invoicePrefix: org.invoicePrefix,
    bankAccountName: org.bank.accountName ?? '',
    bankAccountNumber: org.bank.accountNumber ?? '',
    bankIfsc: org.bank.ifsc ?? '',
    bankName: org.bank.bankName ?? '',
    upiId: org.upiId ?? '',
    invoiceTerms: org.invoiceTerms ?? '',
  };
}
