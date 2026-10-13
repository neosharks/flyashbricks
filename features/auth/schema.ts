import { z } from 'zod';
import { objectId } from '@/lib/form-schema';

/** Either a phone number or an email address; resolved in `lib/auth.ts`. */
export const CredentialsSchema = z
  .object({
    identifier: z.string().trim().min(1, 'required').min(3).max(254),
    password: z.string().min(1).max(200),
  })
  .strict();

/**
 * Length is the only composition rule. Arbitrary character classes push people
 * toward predictable substitutions without adding real entropy.
 */
export const passwordSchema = z.string().min(10, 'passwordTooShort').max(200, 'passwordTooLong');

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'required').max(200),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'passwordsDoNotMatch',
    path: ['confirmPassword'],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'passwordUnchanged',
    path: ['newPassword'],
  });

export const LocaleSchema = z.object({ locale: z.enum(['en', 'hi']) }).strict();

const pinDigits = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'pinFormat');

/** Six of one digit, or a straight run up or down: the first guesses anyone tries. */
function isGuessablePin(pin: string): boolean {
  const digits = Array.from(pin, Number);
  const steps = new Set(digits.slice(1).map((digit, i) => digit - (digits[i] ?? 0)));
  return steps.size === 1 && [0, 1, -1].some((step) => steps.has(step));
}

export const PinSignInSchema = z.object({ pin: pinDigits }).strict();

export const EnrolPinSchema = z
  .object({ pin: pinDigits, confirmPin: z.string().trim() })
  .strict()
  .refine((v) => !isGuessablePin(v.pin), { message: 'pinTooSimple', path: ['pin'] })
  .refine((v) => v.pin === v.confirmPin, { message: 'pinsDoNotMatch', path: ['confirmPin'] });

export const DeviceIdSchema = z.object({ id: objectId() }).strict();
