import { getTranslations } from 'next-intl/server';
import { LinkTabs } from '@/components/ui/tabs';
import { can, type Action, type SessionUser } from '@/lib/permissions';

const TABS: { id: 'business' | 'backup' | 'updates'; href: string; requires: Action }[] = [
  { id: 'business', href: '/settings', requires: 'settings:manage' },
  { id: 'backup', href: '/settings/backup', requires: 'backup:run' },
  { id: 'updates', href: '/settings/updates', requires: 'system:update' },
];

/** Everything an admin configures is one area; the tabs move between its parts. */
export async function SettingsTabs({
  viewer,
  current,
}: {
  viewer: SessionUser;
  current: (typeof TABS)[number]['id'];
}) {
  const t = await getTranslations('settings.tabs');
  return (
    <LinkTabs
      label={t('label')}
      current={current}
      tabs={TABS.filter((tab) => can(viewer, tab.requires)).map((tab) => ({
        id: tab.id,
        href: tab.href,
        label: t(tab.id),
      }))}
    />
  );
}
