'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { updatePreferences } from '@/features/notifications/actions';
import { useActionForm } from '@/hooks/use-action-form';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
} from '@/models/constants';
import type { NotificationPrefs } from '@/models/user';
import { cn } from '@/lib/utils';

/**
 * One card per kind of alert, with a switch per channel. The in-app inbox is
 * shown as always on, so nobody wonders whether they can miss something.
 */
export function PreferencesForm({
  prefs,
  available,
  hasEmail,
}: {
  prefs: NotificationPrefs;
  available: Record<NotificationChannel, boolean>;
  hasEmail: boolean;
}) {
  const t = useTranslations('notifications');
  const tc = useTranslations('common');
  const router = useRouter();
  const form = useActionForm(updatePreferences, () => {
    toast.success(t('prefs.saved'));
    router.refresh();
  });

  return (
    <form method="post" onSubmit={form.onSubmit} className="flex flex-col gap-4">
      {form.formError && <Alert tone="danger">{form.formError}</Alert>}
      {!hasEmail && <Alert tone="info">{t('prefs.noEmail')}</Alert>}

      {NOTIFICATION_CATEGORIES.map((category) => (
        <fieldset key={category} className="border-border bg-surface rounded-lg border p-4">
          <legend className="sr-only">{t(`categories.${category}`)}</legend>
          <p className="font-semibold">{t(`categories.${category}`)}</p>
          <p className="text-foreground-muted mb-3 text-sm">{t(`categoryHints.${category}`)}</p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <span className="border-border bg-surface-muted text-foreground-muted flex min-h-11 items-center justify-between gap-2 rounded-md border px-3 text-sm">
              {t('channels.inApp')}
              <span className="text-xs">{t('prefs.always')}</span>
            </span>
            {NOTIFICATION_CHANNELS.map((channel) => {
              const unavailable = channel === 'email' ? !hasEmail : false;
              return (
                <label
                  key={channel}
                  className={cn(
                    'has-[:checked]:border-action has-[:checked]:bg-action-subtle border-border flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-md border px-3 text-sm',
                    unavailable && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <span>
                    {t(`channels.${channel}`)}
                    {!available[channel] && (
                      <span className="text-foreground-subtle block text-[11px]">
                        {t('prefs.notSetUp')}
                      </span>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    name={`pref_${category}_${channel}`}
                    defaultChecked={prefs[category][channel]}
                    disabled={unavailable}
                    className="accent-action size-5"
                  />
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <Button
        type="submit"
        size="lg"
        loading={form.pending}
        className="w-full sm:w-auto sm:self-start"
      >
        {form.pending ? tc('saving') : tc('saveChanges')}
      </Button>
    </form>
  );
}
