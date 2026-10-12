import { z } from 'zod';
import { bilingualFields } from '@/lib/bilingual';
import { checkbox, optionalEmail, optionalText } from '@/lib/form-schema';
import { normalizePhone } from '@/lib/phone';
import { isStateCode, isValidGstin } from '@/lib/gst';

/** GST rates that apply to building materials; anything else is a typo. */
export const GST_RATES_BPS = [0, 500, 1200, 1800, 2800] as const;

const blank = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value);

const optionalPhone = z.preprocess(
  blank,
  z
    .string()
    .nullable()
    .transform((value, ctx) => {
      if (value === null) return null;
      const phone = normalizePhone(value);
      if (!phone) {
        ctx.addIssue({ code: 'custom', message: 'invalidPhone' });
        return z.NEVER;
      }
      return phone;
    }),
);

/** Optional, but when given it must pass the GSTIN checksum. */
export const optionalGstin = () =>
  z.preprocess(
    (value) => (typeof value === 'string' ? blank(value.trim().toUpperCase()) : value),
    z
      .string()
      .nullable()
      .refine((value) => value === null || isValidGstin(value), 'invalidGstin'),
  );

export const optionalStateCode = () =>
  z.preprocess(
    blank,
    z
      .string()
      .nullable()
      .refine((value) => value === null || isStateCode(value), 'invalid'),
  );

/** Printed on invoices in English with the Hindi beneath. */
const businessName = bilingualFields('name', { max: 120, required: true, min: 2 });
const legalName = bilingualFields('legalName', { max: 160, required: false });
const address = bilingualFields('address', { max: 300, required: false });

export const BusinessSettingsSchema = z
  .object({
    ...businessName.shape,
    ...legalName.shape,
    ...address.shape,
    city: optionalText(80),
    pincode: z.preprocess(
      blank,
      z
        .string()
        .regex(/^[1-9]\d{5}$/, 'invalidPincode')
        .nullable(),
    ),
    stateCode: optionalStateCode(),
    phone: optionalPhone,
    email: optionalEmail(),
    gstRegistered: checkbox(),
    gstin: optionalGstin(),
    gstRateBps: z.coerce
      .number()
      .refine((value) => (GST_RATES_BPS as readonly number[]).includes(value), 'invalid'),
    hsnCode: z.preprocess(
      blank,
      z
        .string()
        .regex(/^\d{4,8}$/, 'invalidHsn')
        .nullable(),
    ),
    invoicePrefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{1,5}$/, 'invalidPrefix'),
    bankAccountName: optionalText(120),
    bankAccountNumber: z.preprocess(
      blank,
      z
        .string()
        .regex(/^\d{6,18}$/, 'invalidAccount')
        .nullable(),
    ),
    bankIfsc: z.preprocess(
      (value) => (typeof value === 'string' ? blank(value.trim().toUpperCase()) : value),
      z
        .string()
        .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'invalidIfsc')
        .nullable(),
    ),
    bankName: optionalText(120),
    upiId: z.preprocess(
      blank,
      z
        .string()
        .trim()
        .regex(/^[\w.-]{2,}@[a-zA-Z]{2,}$/, 'invalidUpi')
        .nullable(),
    ),
    invoiceTerms: optionalText(1000),
  })
  .strict()
  // A GST-registered business needs its GSTIN; everyone else needs nothing.
  .superRefine((value, ctx) => {
    if (value.gstRegistered && !value.gstin) {
      ctx.addIssue({ code: 'custom', path: ['gstin'], message: 'required' });
    }
    businessName.requireOne(value, ctx);
  })
  .transform(
    ({ gstRegistered, bankAccountName, bankAccountNumber, bankIfsc, bankName, ...rest }) => ({
      ...rest,
      // Each name typed in one script fills the other.
      ...legalName.complete(rest),
      ...address.complete(rest),
      ...businessName.complete(rest),
      name: businessName.complete(rest).name ?? '',
      // Turning GST off clears the number, so invoices stop charging tax at once.
      gstin: gstRegistered ? rest.gstin : null,
      gstRateBps: gstRegistered ? rest.gstRateBps : 0,
      // The state on a GSTIN is authoritative.
      stateCode: gstRegistered && rest.gstin ? rest.gstin.slice(0, 2) : rest.stateCode,
      bank: {
        accountName: bankAccountName,
        accountNumber: bankAccountNumber,
        ifsc: bankIfsc,
        bankName,
      },
    }),
  );

export type BusinessSettingsInput = z.infer<typeof BusinessSettingsSchema>;
