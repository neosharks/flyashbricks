import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import type { UserRow } from '@/features/users/types';

export async function UserStatusBadge({
  user,
}: {
  user: Pick<UserRow, 'disabled' | 'lastLoginAt'>;
}) {
  const t = await getTranslations('users.status');
  if (user.disabled) return <Badge tone="danger">{t('disabled')}</Badge>;
  if (!user.lastLoginAt) return <Badge tone="warning">{t('pendingPassword')}</Badge>;
  return <Badge tone="success">{t('active')}</Badge>;
}
