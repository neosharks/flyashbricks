'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Download, TriangleAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { translateDynamic } from '@/lib/i18n-dynamic';
import { PassphraseFields } from './passphrase-fields';

type Failure = { code?: string; fields?: Record<string, string[]>; retryAfter?: number };

function filenameFrom(disposition: string | null): string {
  const match = /filename="([^"]+)"/.exec(disposition ?? '');
  return match?.[1] ?? 'fly-ash-bricks-backup.fabk';
}

/**
 * Posts to the download route and saves the response as a file. A fetch
 * rather than a plain form post so a wrong passphrase or a rate limit shows
 * next to the form instead of replacing the page with an error body.
 */
export function DownloadBackupForm() {
  const t = useTranslations('backup');
  const te = useTranslations('errors');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [unencrypted, setUnencrypted] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const fieldError = (field: string): string | undefined => {
    const key = failure?.fields?.[field]?.[0];
    return key
      ? translateDynamic(t, `validation.${key}`, translateDynamic(te, 'VALIDATION_FAILED', key))
      : undefined;
  };

  async function submit(event: React.SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setFailure(null);

    try {
      const response = await fetch('/api/backup/download', {
        method: 'POST',
        body: new FormData(event.currentTarget),
        credentials: 'same-origin',
      });

      if (!response.ok) {
        setFailure((await response.json().catch(() => ({}))) as Failure);
        return;
      }

      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = filenameFrom(response.headers.get('content-disposition'));
      document.body.append(link);
      link.click();
      link.remove();
      // Some mobile browsers read the blob after the click returns.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      formRef.current?.reset();
      setUnencrypted(false);
      toast.success(t('download.done'));
      router.refresh();
    } catch {
      setFailure({ code: 'INTERNAL_ERROR' });
    } finally {
      setPending(false);
    }
  }

  const formError =
    failure && !failure.fields
      ? translateDynamic(te, failure.code ?? 'INTERNAL_ERROR', te('INTERNAL_ERROR'), {
          seconds: failure.retryAfter ?? 0,
        })
      : null;

  return (
    <form
      ref={formRef}
      method="post"
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-4"
      noValidate
    >
      {formError && <Alert tone="danger">{formError}</Alert>}

      <PassphraseFields error={fieldError} disabled={unencrypted} />

      {/* Tucked away: a file without a password is rarely the right choice. */}
      <details className="text-sm">
        <summary className="text-foreground-muted hover:text-foreground cursor-pointer select-none">
          {t('download.moreOptions')}
        </summary>
        <div className="mt-3 flex flex-col gap-2">
          <label className="flex items-start gap-2">
            <Checkbox
              name="unencrypted"
              checked={unencrypted}
              onChange={(event) => setUnencrypted(event.target.checked)}
              className="mt-0.5"
            />
            {t('download.unencrypted')}
          </label>
          {unencrypted && (
            <>
              <p
                role="alert"
                className="bg-danger-subtle text-danger flex gap-2 rounded-md px-3 py-2 font-medium"
              >
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {t('download.unencryptedWarning')}
              </p>
              <Field
                label={t('download.currentPassword')}
                hint={t('download.currentPasswordHint')}
                required
                error={fieldError('currentPassword')}
              >
                {(props) => (
                  <PasswordInput
                    {...props}
                    name="currentPassword"
                    autoComplete="current-password"
                    required
                  />
                )}
              </Field>
            </>
          )}
        </div>
      </details>

      <Button type="submit" size="lg" full loading={pending}>
        {!pending && <Download aria-hidden />}
        {pending ? t('download.preparing') : t('download.submit')}
      </Button>
    </form>
  );
}
