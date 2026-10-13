import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { PackageCheck, Tag } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Page } from '@/components/ui/page';
import { UpdatePanel } from '@/components/system/update-panel';
import { SettingsTabs } from '@/components/settings/settings-tabs';
import { fetchLatestRelease } from '@/features/system/releases';
import { readUpdaterState } from '@/features/system/updater';
import { isNewer } from '@/features/system/version';
import { env } from '@/lib/env';
import { requirePermissionPage } from '@/lib/session';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Updates' };

export default async function UpdatesPage() {
  const viewer = await requirePermissionPage('/settings/updates', 'system:update');
  const [t, locale, state, latest] = await Promise.all([
    getTranslations('system'),
    getLocale(),
    readUpdaterState(env.UPDATER_DIR),
    fetchLatestRelease(env.UPDATE_REPO),
  ]);
  const newer = latest !== null && isNewer(latest.version, env.APP_VERSION);

  return (
    <Page size="medium">
      <PageHeader title={t('title')} description={t('description')} />
      <SettingsTabs viewer={viewer} current="updates" />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label={t('current.label')}
          value={env.APP_VERSION}
          hint={t('current.hint')}
          icon={PackageCheck}
          tone="neutral"
        />
        <StatCard
          label={t('latest.label')}
          value={latest ? latest.version : t('latest.unknown')}
          hint={
            !latest
              ? t('latest.unknownHint')
              : newer
                ? latest.publishedAt
                  ? t('latest.published', { date: formatDate(latest.publishedAt, locale) })
                  : t('latest.available')
                : t('latest.upToDate')
          }
          icon={Tag}
          tone={!latest ? 'neutral' : newer ? 'warning' : 'success'}
        />
      </div>

      <UpdatePanel
        key={`${state.pending}-${state.status?.state ?? ''}-${state.status?.startedAt ?? ''}`}
        current={env.APP_VERSION}
        latest={latest}
        newer={newer}
        initial={state}
      />
    </Page>
  );
}
