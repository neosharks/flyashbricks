'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { MonitorSmartphone, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Field } from '@/components/ui/field';
import { FormErrors } from '@/components/ui/form-errors';
import { Input } from '@/components/ui/input';
import { enrolDevicePin, removeDevicePin } from '@/features/auth/actions';
import type { DevicePinRow } from '@/features/auth/types';
import { EnrolPinSchema } from '@/features/auth/schema';
import { useActionForm } from '@/hooks/use-action-form';
import { formatDate } from '@/lib/utils';

/** Six digits on the number pad, hidden like a password. */
function PinInput(props: React.ComponentPropsWithRef<'input'>) {
  return (
    <Input
      {...props}
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={6}
      autoComplete="off"
      required
    />
  );
}

/** Set a PIN for this device, and see or remove the PINs on every device. */
export function DevicePinSettings({
  allowed,
  devices,
}: {
  allowed: boolean;
  devices: DevicePinRow[];
}) {
  const t = useTranslations('auth.quickPin');
  const locale = useLocale();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const form = useActionForm(
    enrolDevicePin,
    () => {
      toast.success(t('saved'));
      formRef.current?.reset();
      router.refresh();
    },
    { schema: EnrolPinSchema },
  );
  const hasCurrent = devices.some((device) => device.current);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-foreground-muted text-sm">{t('description')}</p>

      {allowed ? (
        <form
          ref={formRef}
          method="post"
          onSubmit={form.onSubmit}
          onChange={form.onChange}
          onBlur={form.onBlur}
          className="flex flex-col gap-4"
          noValidate
        >
          <FormErrors form={form} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('newPin')} required error={form.error('pin')}>
              {(props) => <PinInput {...props} name="pin" />}
            </Field>
            <Field label={t('confirmPin')} required error={form.error('confirmPin')}>
              {(props) => <PinInput {...props} name="confirmPin" />}
            </Field>
          </div>
          <p className="text-foreground-muted -mt-2 text-xs">{t('pinHint')}</p>
          <Button type="submit" loading={form.pending} className="self-start">
            {hasCurrent ? t('replace') : t('save')}
          </Button>
        </form>
      ) : (
        <Alert>{t('notAllowed')}</Alert>
      )}

      <section aria-labelledby="pin-devices" className="flex flex-col gap-2">
        <h3 id="pin-devices" className="text-sm font-medium">
          {t('devices')}
        </h3>
        {devices.length === 0 ? (
          <p className="text-foreground-muted text-sm">{t('noDevices')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {devices.map((device) => (
              <li
                key={device.id}
                className="border-border flex items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <MonitorSmartphone aria-hidden className="text-foreground-muted size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {device.label || t('unknownDevice')}
                    {device.current && <Badge tone="info">{t('thisDevice')}</Badge>}
                  </p>
                  <p className="text-foreground-muted text-xs">
                    {t('created', { date: formatDate(device.createdAt, locale) })}
                    {' · '}
                    {device.lastUsedAt
                      ? t('lastUsed', { date: formatDate(device.lastUsedAt, locale) })
                      : t('neverUsed')}
                  </p>
                </div>
                <ConfirmButton
                  title={t('removeTitle')}
                  description={t('removeBody')}
                  confirmLabel={t('remove')}
                  successMessage={t('removed')}
                  variant="ghost"
                  size="sm"
                  action={() => removeDevicePin(device.id)}
                >
                  <Trash2 aria-hidden />
                  {t('remove')}
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
