import { z } from 'zod';

/** Either a phone number or an email address; resolved in `lib/auth.ts`. */
export const CredentialsSchema = z
  .object({
    identifier: z.string().trim().min(3).max(254),
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
