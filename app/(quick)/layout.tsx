import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/layout/brand-mark';
import { LanguageSwitch } from '@/components/layout/language-switch';
import { UserMenu } from '@/components/layout/user-menu';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { unreadCount } from '@/features/notifications/queries';
import { requireUserPage } from '@/lib/session';

/** Every page in here is per-user: never cached, never prerendered. */
export const dynamic = 'force-dynamic';

/**
 * Simple mode: no sidebar and no tab bar, one column sized for a phone held
 * in one hand, so the only things on screen are the task and its buttons.
 */
export default async function QuickLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage('/quick');
  const [t, tu, unread] = await Promise.all([
    getTranslations('common'),
    getTranslations('users'),
    unreadCount(user),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border bg-surface/90 sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between gap-3 px-4">
          <BrandMark name={t('appName')} />
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <NotificationBell initialUnread={unread} />
            <UserMenu
              name={user.name}
              roleLabel={tu(`roles.${user.role}`)}
              imageId={user.avatarAssetId ?? null}
              gender={user.gender ?? 'unspecified'}
              variant={user.avatarVariant ?? 0}
            />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-4">
        {children}
      </main>
    </div>
  );
}
