import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/page-header';
import { BusinessSettingsForm } from '@/components/settings/business-settings-form';
import { SettingsTabs } from '@/components/settings/settings-tabs';
import { getOrganization, toSettingsValues } from '@/features/settings/queries';
import { requirePermissionPage } from '@/lib/session';
import { Page } from '@/components/ui/page';

export const metadata: Metadata = { title: 'Business settings' };

export default async function SettingsPage() {
  const viewer = await requirePermissionPage('/settings', 'settings:manage');
  const [org, t] = await Promise.all([getOrganization(viewer), getTranslations('settings')]);
  if (!org) notFound();

  return (
    <Page size="narrow">
      <PageHeader title={t('title')} description={t('description')} />
      <SettingsTabs viewer={viewer} current="business" />
      <BusinessSettingsForm values={toSettingsValues(org)} />
    </Page>
  );
}
