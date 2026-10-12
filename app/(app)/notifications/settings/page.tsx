import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PreferencesForm } from '@/components/notifications/preferences-form';
import { availableChannels } from '@/features/notifications/channels';
import { getPreferences } from '@/features/notifications/queries';
import { requireUserPage } from '@/lib/session';
import { NOTIFICATION_CHANNELS } from '@/models/constants';
import { Page } from '@/components/ui/page';

export const metadata: Metadata = { title: 'Choose alerts' };

export default async function NotificationSettingsPage() {
  const viewer = await requireUserPage('/notifications/settings');
  const [t, preferences] = await Promise.all([
    getTranslations('notifications'),
    getPreferences(viewer),
  ]);
  if (!preferences) notFound();
  const available = availableChannels();

  return (
    <Page size="narrow">
      <PageHeader
        title={t('prefs.title')}
        description={t('prefs.description')}
        back={{ href: '/notifications', label: t('title') }}
      />

      {viewer.role === 'admin' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('prefs.channelStatus')}</CardTitle>
            <p className="text-foreground-muted text-sm">{t('prefs.channelStatusHint')}</p>
          </CardHeader>
          <CardBody>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle2 aria-hidden className="text-success size-4" />
                {t('channels.inApp')} · {t('prefs.on')}
              </li>
              {NOTIFICATION_CHANNELS.map((channel) => (
                <li key={channel} className="flex items-center gap-2 text-sm">
                  {available[channel] ? (
                    <CheckCircle2 aria-hidden className="text-success size-4" />
                  ) : (
                    <CircleDashed aria-hidden className="text-foreground-subtle size-4" />
                  )}
                  {t(`channels.${channel}`)} · {available[channel] ? t('prefs.on') : t('prefs.off')}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <PreferencesForm
        prefs={preferences.prefs}
        available={available}
        hasEmail={preferences.hasEmail}
      />
    </Page>
  );
}
