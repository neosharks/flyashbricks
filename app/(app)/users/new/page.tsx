import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/page-header';
import { UserForm } from '@/components/users/user-form';
import { requirePermissionPage } from '@/lib/session';
import { Page } from '@/components/ui/page';

export const metadata: Metadata = { title: 'Add employee' };

export default async function NewUserPage() {
  const viewer = await requirePermissionPage('/users/new', 'users:write');
  const t = await getTranslations('users');
  const admin = viewer.role === 'admin';

  return (
    <Page size="narrow">
      <PageHeader
        title={t('newTitle')}
        description={t('newDescription')}
        back={{ href: '/users', label: t('title') }}
      />
      <div className="border-border bg-surface rounded-lg border p-4 sm:p-6">
        <UserForm actorIsAdmin={admin} ceiling={admin ? null : viewer.permissions} />
      </div>
    </Page>
  );
}
