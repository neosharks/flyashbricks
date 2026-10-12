import { z } from 'zod';
import { bilingualFields } from '@/lib/bilingual';
import { LIMITS, PAYMENT_MODES } from '@/models/constants';
import {
  count,
  dayKey,
  objectId,
  optionalText,
  phone,
  rupees,
  rupeesOrZero,
} from '@/lib/form-schema';

/**
 * Line fields arrive flat from the form (`lines.0.qty`, `lines.0.rate`, …) and
 * are folded into an array here, ordered by row number, before validation.
 */
export function foldLines(raw: Record<string, unknown>): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  const rows = new Map<number, Record<string, unknown>>();
  for (const [key, value] of Object.entries(raw)) {
    const match = /^lines\.(\d{1,2})\.(productId|qty|rate)$/.exec(key);
    if (!match) {
      rest[key] = value;
      continue;
    }
    const index = Number(match[1]);
    const row = rows.get(index) ?? {};
    row[match[2] ?? ''] = value;
    rows.set(index, row);
  }
  const lines = [...rows.entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
  return { ...rest, lines };
}

const LineSchema = z
  .object({
    productId: objectId(),
    qty: count({ min: 1, max: LIMITS.bricksPerEntry }),
    rate: rupees(),
  })
  .strict();

/** A customer added on the spot from the sale form, named in English and Hindi. */
const newCustomerName = bilingualFields('newCustomerName', { max: 120, required: false, min: 2 });

export const CreateSaleSchema = z
  .object({
    customerMode: z.enum(['existing', 'new'], 'invalid'),
    customerId: z.preprocess((value) => (value === '' ? undefined : value), objectId().optional()),
    ...newCustomerName.shape,
    newCustomerPhone: z.preprocess(
      (value) => (value === '' ? undefined : value),
      phone().optional(),
    ),
    date: dayKey(),
    lines: z
      .array(LineSchema)
      .min(1, 'atLeastOneLine')
      .max(LIMITS.linesPerSale, 'tooBig')
      .superRefine((lines, ctx) => {
        const seen = new Set<string>();
        lines.forEach((line, index) => {
          if (seen.has(line.productId)) {
            ctx.addIssue({
              code: 'custom',
              message: 'duplicateProduct',
              path: [index, 'productId'],
            });
          }
          seen.add(line.productId);
        });
      }),
    delivery: rupeesOrZero(),
    discount: rupeesOrZero(),
    vehicleNo: optionalText(20),
    deliveryAddress: optionalText(300),
    note: optionalText(500),
    paymentAmount: rupeesOrZero(),
    paymentMode: z.enum(PAYMENT_MODES, 'invalid').default('cash'),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.customerMode === 'existing' && !value.customerId) {
      ctx.addIssue({ code: 'custom', message: 'required', path: ['customerId'] });
    }
    if (value.customerMode === 'new') {
      if (!value.newCustomerName && !value.newCustomerNameHi) {
        ctx.addIssue({ code: 'custom', message: 'required', path: ['newCustomerName'] });
      }
      if (!value.newCustomerPhone) {
        ctx.addIssue({ code: 'custom', message: 'invalidPhone', path: ['newCustomerPhone'] });
      }
    }
  })
  // The name typed in one script fills the other.
  .transform((value) => ({ ...value, ...newCustomerName.complete(value) }));
export type CreateSaleInput = z.infer<typeof CreateSaleSchema>;

export const AddPaymentSchema = z
  .object({
    saleId: objectId(),
    amount: rupees({ min: 1 }),
    mode: z.enum(PAYMENT_MODES, 'invalid'),
    date: dayKey(),
    note: optionalText(300),
  })
  .strict();
export type AddPaymentInput = z.infer<typeof AddPaymentSchema>;

export const VoidSaleSchema = z
  .object({
    saleId: objectId(),
    reason: z.string('required').trim().min(3, 'required').max(300, 'tooBig'),
  })
  .strict();
export type VoidSaleInput = z.infer<typeof VoidSaleSchema>;
