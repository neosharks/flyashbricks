import { z } from 'zod';
import { LIMITS } from '@/models/constants';
import { objectId, optionalText, phone } from '@/lib/form-schema';
import { bilingualFields } from '@/lib/bilingual';
import { isStateCode, isValidGstin, type StateCode } from '@/lib/gst';

/**
 * GST is optional: blank means the customer buys without a GST bill. When
 * something is entered it must be a real GSTIN, check character included, so
 * a typo never reaches an invoice.
 */
const gstin = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim().toUpperCase() : null),
  z.string().refine(isValidGstin, 'invalidGstin').nullable(),
);

/** GST state for place of supply; optional, blank means the yard's own state. */
const stateCode = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.custom<StateCode>(isStateCode, 'invalid').nullable(),
);

/**
 * Phone rows arrive as repeated `phones` fields, blanks included (an empty
 * row the person added and did not fill). Blanks are dropped; duplicates are
 * reported against the row that repeats.
 */
const phones = z
  .preprocess(
    (value): unknown[] =>
      (Array.isArray(value) ? (value as unknown[]) : [value]).filter(
        (entry) => typeof entry !== 'string' || entry.trim() !== '',
      ),
    z.array(phone()).min(1, 'required').max(LIMITS.phonesPerCustomer, 'tooBig'),
  )
  .superRefine((list, ctx) => {
    list.forEach((number, index) => {
      if (list.indexOf(number) !== index) {
        ctx.addIssue({ code: 'custom', message: 'duplicatePhone', path: [index] });
      }
    });
  });

/** Name, city and address are kept in English and Hindi; either may be typed. */
const name = bilingualFields('name', { max: 120, required: true, min: 2 });
const city = bilingualFields('city', { max: 80, required: false });
const address = bilingualFields('address', { max: 300, required: false });

const fields = {
  ...name.shape,
  phones,
  ...address.shape,
  ...city.shape,
  gstin,
  stateCode,
  notes: optionalText(1000),
};

function bilingual<T extends Record<string, unknown>>(value: T) {
  const filled = { ...name.complete(value), ...city.complete(value), ...address.complete(value) };
  // `requireOne` has run, so the English name is always filled here.
  return { ...value, ...filled, name: filled.name ?? '' };
}

export const CreateCustomerSchema = z
  .object(fields)
  .strict()
  .superRefine((value, ctx) => name.requireOne(value, ctx))
  .transform(bilingual);
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

export const UpdateCustomerSchema = z
  .object({ id: objectId(), ...fields })
  .strict()
  .superRefine((value, ctx) => name.requireOne(value, ctx))
  .transform(bilingual);
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;

export const CustomerSearchSchema = z.object({ q: z.string().trim().max(80) }).strict();
