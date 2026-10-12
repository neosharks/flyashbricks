import { z } from 'zod';
import { MAX_AMOUNT_PAISE, parseRupees } from './money';
import { MAX_QUANTITY_MILLI, parseQuantity } from './quantity';
import { normalizePhone } from './phone';
import { DAY_KEY_PATTERN } from './dates';

/**
 * Zod helpers for HTML form semantics.
 *
 * Forms do not send what a schema naively expects: an unchecked checkbox sends
 * nothing, an empty field sends `''` rather than `null`, and money is typed in
 * rupees with commas. Each of those mistakes is silent, so they live here once
 * rather than being re-derived per form. Messages are translation keys.
 */

const blankToNull = (value: unknown) =>
  value === '' || value === undefined || value === null ? null : value;

/** Checked boxes arrive as `'on'`; unchecked ones are simply absent. */
export const checkbox = () =>
  z.preprocess((value) => value === true || value === 'on' || value === 'true', z.boolean());

/** Rupees as typed ("1,250.50") → integer paise. */
export const rupees = (options?: { min?: number }) =>
  z.preprocess(
    (value) => {
      if (typeof value === 'number') return value;
      if (typeof value !== 'string' || value.trim() === '') return undefined;
      return parseRupees(value) ?? Number.NaN;
    },
    z
      .number('invalidAmount')
      .int('invalidAmount')
      .min(options?.min ?? 0, 'invalidAmount')
      .max(MAX_AMOUNT_PAISE, 'tooBig'),
  );

/** An optional rupee field: blank means zero. */
export const rupeesOrZero = () =>
  z.preprocess((value) => (value === '' || value === undefined ? 0 : value), rupees());

/** A quantity as typed ("1,250.5") → integer milli-units. */
export const quantity = (options?: { min?: number }) =>
  z.preprocess(
    (value) => {
      if (typeof value === 'number') return value;
      if (typeof value !== 'string' || value.trim() === '') return undefined;
      return parseQuantity(value) ?? Number.NaN;
    },
    z
      .number('invalidQuantity')
      .int('invalidQuantity')
      .min(options?.min ?? 0, 'invalidQuantity')
      .max(MAX_QUANTITY_MILLI, 'tooBig'),
  );

/** Whole bricks. */
export const count = (options: { min: number; max: number }) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.replace(/[,\s]/g, '') : value),
    z.coerce
      .number('invalid')
      .int('invalid')
      .min(options.min, 'tooSmall')
      .max(options.max, 'tooBig'),
  );

export const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? blankToNull(value.trim()) : blankToNull(value)),
    z.string().max(max, 'tooBig').nullable(),
  );

export const phone = () =>
  z
    .string('invalidPhone')
    .trim()
    .transform((value, ctx) => {
      const normalized = normalizePhone(value);
      if (!normalized) {
        ctx.addIssue({ code: 'custom', message: 'invalidPhone' });
        return z.NEVER;
      }
      return normalized;
    });

export const optionalEmail = () =>
  z.preprocess(
    (value) => (typeof value === 'string' ? blankToNull(value.trim().toLowerCase()) : null),
    z.email('invalidEmail').max(254, 'tooBig').nullable(),
  );

/** A `<input type="date">` value, kept as the day key it is. */
export const dayKey = () => z.string('invalidDate').regex(DAY_KEY_PATTERN, 'invalidDate');

export const objectId = () => z.string().regex(/^[a-f\d]{24}$/i, 'invalid');
