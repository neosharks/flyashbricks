import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ChangePasswordForm } from '@/components/auth/change-password-form';
import { DevicePinSettings } from '@/components/auth/device-pin-settings';
import { SignOutEverywhereButton } from '@/components/auth/sign-out-everywhere';
import { LanguageSwitch } from '@/components/layout/language-switch';
import { SignOutButton } from '@/components/layout/sign-out-button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { DisplaySettings } from '@/components/layout/display-settings';
import { AccessSummary } from '@/components/users/access-matrix';
import { AvatarUploader } from '@/components/users/avatar-uploader';
import { isPinSignInAllowed, listDevicePins } from '@/features/auth/device-pin';
import { DEVICE_COOKIE_NAME } from '@/lib/cookies';
import { requireUserPage } from '@/lib/session';
import { Page } from '@/components/ui/page';

export const metadata: Metadata = { title: 'My account' };

export default async function AccountPage() {
  const user = await requireUserPage('/account');
  const token = (await cookies()).get(DEVICE_COOKIE_NAME)?.value ?? null;
  const [t, tu, tc, pinAllowed, pinDevices] = await Promise.all([
    getTranslations('auth'),
    getTranslations('users'),
    getTranslations('common'),
    isPinSignInAllowed(user),
    listDevicePins(user, token),
  ]);

  return (
    <Page size="narrow">
      <PageHeader title={t('accountTitle')} description={user.name} />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('profile')}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4 text-sm">
            <AvatarUploader
              userId={user.id}
              name={user.name}
              imageId={user.avatarAssetId ?? null}
              gender={user.gender ?? 'unspecified'}
              variant={user.avatarVariant ?? 0}
              canEdit
            />
            <p>
              <span className="text-foreground-muted">{t('role')}: </span>
              {tu(`roles.${user.role}`)}
            </p>
            <AccessSummary permissions={user.permissions} admin={user.role === 'admin'} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('preferences')}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-foreground-muted text-sm">{tc('language.label')}</span>
              <LanguageSwitch />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-foreground-muted text-sm">{tc('theme.label')}</span>
              <ThemeToggle />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tc('display.title')}</CardTitle>
          </CardHeader>
          <CardBody>
            <DisplaySettings />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('security')}</CardTitle>
          </CardHeader>
          <CardBody className="flex max-w-md flex-col gap-6">
            <ChangePasswordForm temporary={false} />
            <div className="border-border border-t pt-5">
              <SignOutEverywhereButton />
            </div>
          </CardBody>
        </Card>

        <Card id="quick-sign-in">
          <CardHeader>
            <CardTitle>{t('quickPin.title')}</CardTitle>
          </CardHeader>
          <CardBody className="max-w-xl">
            <DevicePinSettings allowed={pinAllowed} devices={pinDevices} />
          </CardBody>
        </Card>

        <SignOutButton className="self-start lg:hidden" />
      </div>
    </Page>
  );
}
