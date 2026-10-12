import { z } from 'zod';
import { checkbox } from '@/lib/form-schema';
import { MIN_PASSPHRASE_LENGTH } from '@/lib/backup-crypto';

/**
 * Messages are keys under `backup.validation`: the backup forms translate
 * them themselves, so this feature adds nothing to the shared validation file.
 */
const passphrase = z
  .string('passphraseTooShort')
  .min(MIN_PASSPHRASE_LENGTH, 'passphraseTooShort')
  .max(200, 'passphraseTooLong');

export const DownloadBackupSchema = z
  .object({
    unencrypted: checkbox(),
    passphrase: z.string().max(200, 'passphraseTooLong').default(''),
    confirmPassphrase: z.string().max(200).default(''),
    /** Only for an unencrypted file: the admin's own login password, checked by the route. */
    currentPassword: z.string().max(200).default(''),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.unencrypted) {
      if (value.currentPassword === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['currentPassword'],
          message: 'currentPasswordRequired',
        });
      }
      return;
    }
    if (value.passphrase.length < MIN_PASSPHRASE_LENGTH) {
      ctx.addIssue({ code: 'custom', path: ['passphrase'], message: 'passphraseTooShort' });
    } else if (value.passphrase !== value.confirmPassphrase) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassphrase'],
        message: 'passphrasesDoNotMatch',
      });
    }
  });

export const EmailBackupSchema = z
  .object({
    to: z.email('invalidEmail').max(254).toLowerCase(),
    passphrase,
    confirmPassphrase: z.string().max(200),
  })
  .strict()
  .refine((value) => value.passphrase === value.confirmPassphrase, {
    message: 'passphrasesDoNotMatch',
    path: ['confirmPassphrase'],
  });
