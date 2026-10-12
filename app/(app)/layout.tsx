import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/layout/brand-mark';
import { LanguageSwitch } from '@/components/layout/language-switch';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { MobileTabBar, SidebarNav } from '@/components/layout/app-nav';
import { UserMenu } from '@/components/layout/user-menu';
import { SignOutButton } from '@/components/layout/sign-out-button';
import { DisplaySettings } from '@/components/layout/display-settings';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { unreadCount } from '@/features/notifications/queries';
import { requireUserPage } from '@/lib/session';
import { navItemsFor } from '@/lib/navigation';

/** Every page in here is per-user: never cached, never prerendered. */
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage('/');
  const [t, tu, unread] = await Promise.all([
    getTranslations('common'),
    getTranslations('users'),
    unreadCount(user),
  ]);
  const items = navItemsFor(user);

  return (
    <div className="flex min-h-dvh">
      <aside className="border-border bg-surface sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r p-4 lg:flex">
        <BrandMark name={t('appName')} tagline={t('tagline')} />
        <SidebarNav items={items} />
        <div className="border-border mt-auto flex flex-col gap-3 border-t pt-4">
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <ThemeToggle />
          </div>
          <DisplaySettings compact />
          <SignOutButton className="w-full justify-start" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-surface/90 sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-8">
            <div className="lg:hidden">
              <BrandMark name={t('appName')} />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <LanguageSwitch className="lg:hidden" />
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

        <main
          id="main"
          className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-8 lg:pb-12"
        >
          {children}
        </main>
      </div>

      <MobileTabBar
        items={items}
        extra={
          <div className="border-border mt-2 flex flex-col gap-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-foreground-muted text-sm">{t('theme.label')}</span>
              <ThemeToggle />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-foreground-muted text-sm">{t('display.size')}</span>
              <DisplaySettings compact />
            </div>
            <SignOutButton className="w-full" />
          </div>
        }
      />
    </div>
  );
}
