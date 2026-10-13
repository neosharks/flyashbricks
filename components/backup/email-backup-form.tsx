'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { FormErrors } from '@/components/ui/form-errors';
import { Input } from '@/components/ui/input';
import { emailBackup } from '@/features/backup/actions';
import { useActionForm } from '@/hooks/use-action-form';
import { translateDynamic } from '@/lib/i18n-dynamic';
import { PassphraseFields } from './passphrase-fields';

export function EmailBackupForm({ defaultTo }: { defaultTo: string }) {
  const t = useTranslations('backup');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  // No schema: the backup schema shares its passphrase rule with the
  // server-only encryption code, so these fields are checked by the server.
  const form = useActionForm(
    emailBackup,
    (data) => {
      toast.success(t('email.done', { to: data.to }));
      // Clears the passphrase fields; the address is kept for the next one.
      for (const name of ['passphrase', 'confirmPassphrase']) {
        const input = formRef.current?.elements.namedItem(name);
        if (input instanceof HTMLInputElement) input.value = '';
      }
      router.refresh();
    },
    {
      // Keys this feature owns are translated here; shared ones arrive translated.
      translate: (message) => translateDynamic(t, `validation.${message}`, message),
    },
  );
  const formError =
    form.state && !form.state.ok && form.state.code === 'BACKUP_TOO_LARGE'
      ? t('email.tooLarge')
      : form.formError;

  return (
    <form
      ref={formRef}
      method="post"
      onSubmit={form.onSubmit}
      onChange={form.onChange}
      onBlur={form.onBlur}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormErrors form={{ ...form, formError }} />

      <Field label={t('email.to')} required error={form.error('to')}>
        {(props) => (
          <Input
            {...props}
            name="to"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            defaultValue={defaultTo}
            required
          />
        )}
      </Field>

      <PassphraseFields error={form.error} />

      <Button type="submit" size="lg" variant="outline" full loading={form.pending}>
        {!form.pending && <Mail aria-hidden />}
        {form.pending ? t('email.sending') : t('email.submit')}
      </Button>
    </form>
  );
}
