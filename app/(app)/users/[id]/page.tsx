import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { FilterPills } from '@/components/ui/filter-pills';
import { Page } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import {
  Pagination,
  SortableTH,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui/data-table';
import { ActivityList } from '@/components/activity/activity-list';
import { AvatarUploader } from '@/components/users/avatar-uploader';
import { UserForm } from '@/components/users/user-form';
import { UserSecurityActions } from '@/components/users/user-security-actions';
import { UserStatusBadge } from '@/components/users/user-status-badge';
import { getLoginHistory, getUser, getUserActivity, LOGIN_SORTS } from '@/features/users/queries';
import type { LoginEventRow } from '@/features/users/types';
import { can, canManageUser } from '@/lib/permissions';
import { formatPhone } from '@/lib/phone';
import { requirePermissionPage } from '@/lib/session';
import { parseTableParams } from '@/lib/table';
import { formatDate, formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Employee' };

type SearchParams = Record<string, string | string[] | undefined>;

/** The sign-in table has its own sort and cursor, prefixed so they never clash with anything else here. */
const LOGIN = 'login_';

const LOGIN_REASONS = [
  'bad_password',
  'disabled',
  'expired',
  'bad_pin',
  'pin_locked',
  'pin_revoked',
] as const;

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const viewer = await requirePermissionPage(`/users/${id}`, 'users:read');
  const query = await searchParams;
  const loginTable = parseTableParams(
    query,
    LOGIN_SORTS,
    { sort: 'createdAt', dir: 'desc', size: 10 },
    LOGIN,
  );
  const rawResult = Array.isArray(query.login_result) ? query.login_result[0] : query.login_result;
  const result = rawResult === 'success' || rawResult === 'failed' ? rawResult : null;

  // Sign-in history holds IP addresses and devices: admins see everyone's,
  // others only their own. The activity log is admin-only everywhere.
  const isSelf = id === viewer.id;
  const showLogins = viewer.role === 'admin' || isSelf;
  const showActivity = can(viewer, 'activity:read');
  const [user, logins, activity, t, locale] = await Promise.all([
    getUser(viewer, id),
    showLogins
      ? getLoginHistory(viewer, id, { ...loginTable, result })
      : Promise.resolve({ rows: [], next: null, prev: null }),
    showActivity ? getUserActivity(viewer, id) : Promise.resolve([]),
    getTranslations('users'),
    getLocale(),
  ]);
  if (!user) notFound();

  const canManage = canManageUser(viewer, {
    orgId: viewer.orgId,
    role: user.role,
    permissions: user.permissions,
  });
  const admin = viewer.role === 'admin';
  const basePath = `/users/${id}`;

  const failIcon = <XCircle aria-hidden className="text-danger mt-0.5 size-4 shrink-0" />;

  const outcome = (login: LoginEventRow) => {
    const reason = LOGIN_REASONS.find((value) => value === login.reason);
    const result = login.success
      ? t('detail.success')
      : reason
        ? `${t('detail.failed')} · ${t(`detail.reasons.${reason}`)}`
        : t('detail.failed');
    return login.method === 'pin' ? `${result} · ${t('detail.withPin')}` : result;
  };

  return (
    <Page size="medium">
      <PageHeader title={user.name} back={{ href: '/users', label: t('title') }}>
        <div className="text-foreground-muted mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={user.role === 'admin' ? 'info' : 'neutral'}>{t(`roles.${user.role}`)}</Badge>
          <UserStatusBadge user={user} />
          {!user.pinSignInAllowed && <Badge tone="neutral">{t('pinOff')}</Badge>}
          <span className="tabular-nums">{formatPhone(user.phone)}</span>
          {isSelf && <Badge tone="info">{t('detail.you')}</Badge>}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t('detail.profile')}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-6">
            <AvatarUploader
              userId={user.id}
              name={user.name}
              imageId={user.avatarAssetId}
              gender={user.gender}
              variant={user.avatarVariant}
              canEdit={canManage}
              size="xl"
            />
            {canManage ? (
              <UserForm
                user={user}
                actorIsAdmin={admin}
                ceiling={admin ? null : viewer.permissions}
                isSelf={isSelf}
              />
            ) : (
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-foreground-muted">{t('form.email')}</dt>
                  <dd>{user.email ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-foreground-muted">{t('form.jobTitle')}</dt>
                  <dd>{user.jobTitle ?? '—'}</dd>
                </div>
              </dl>
            )}
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          {canManage && !isSelf && (
            <Card>
              <CardHeader>
                <CardTitle>{t('detail.security')}</CardTitle>
              </CardHeader>
              <CardBody>
                <UserSecurityActions id={user.id} name={user.name} disabled={user.disabled} />
              </CardBody>
            </Card>
          )}

          {showActivity && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>{t('detail.activity')}</CardTitle>
                {showActivity && (
                  <Link
                    href={`/activity?user=${user.id}`}
                    className="text-action -my-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium"
                  >
                    {t('detail.seeAllActivity')}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                )}
              </CardHeader>
              <CardBody>
                <ActivityList rows={activity} empty={t('detail.activityEmpty')} showActor={false} />
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {showLogins && (
        <section className="mt-8" aria-labelledby="sign-ins">
          <div className="mb-3 flex flex-col gap-1">
            <h2 id="sign-ins" className="text-lg font-semibold">
              {t('detail.loginHistory')}
            </h2>
            <p className="text-foreground-muted text-xs">
              {t('detail.joined')}: {formatDate(user.createdAt, locale)}
            </p>
          </div>
          <div className="mb-3">
            <FilterPills
              label={t('detail.loginFilter.label')}
              param="login_result"
              basePath={basePath}
              query={query}
              options={[
                { value: null, label: t('detail.loginFilter.all') },
                { value: 'success', label: t('detail.loginFilter.success') },
                { value: 'failed', label: t('detail.loginFilter.failed') },
              ]}
            />
          </div>

          {logins.rows.length === 0 ? (
            <p className="text-foreground-muted brick-pattern rounded-lg p-6 text-center text-sm">
              {t('detail.loginHistoryEmpty')}
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-2 md:hidden">
                {logins.rows.map((login) => (
                  <li
                    key={login.id}
                    className="border-border bg-surface flex items-start gap-3 rounded-lg border p-3 text-sm"
                  >
                    {login.success ? (
                      <CheckCircle2 aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
                    ) : (
                      failIcon
                    )}
                    <div className="min-w-0">
                      <p className="font-medium">{outcome(login)}</p>
                      <p className="text-foreground-muted text-xs">
                        {formatDateTime(login.createdAt, locale)}
                        {login.ip ? ` · ${login.ip}` : ''}
                      </p>
                      {login.userAgent && (
                        <p className="text-foreground-subtle truncate text-xs">{login.userAgent}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <Table
                caption={t('detail.loginHistory')}
                className="hidden md:block"
                minWidth="40rem"
              >
                <THead>
                  <SortableTH
                    column="createdAt"
                    label={t('detail.lastLogin')}
                    sort={loginTable.sort}
                    dir={loginTable.dir}
                    basePath={basePath}
                    query={query}
                    defaultDir="desc"
                    prefix={LOGIN}
                  />
                  <TH>{t('columns.status')}</TH>
                  <TH>IP</TH>
                  <TH>{t('detail.device')}</TH>
                </THead>
                <TBody>
                  {logins.rows.map((login) => (
                    <TR key={login.id}>
                      <TD muted className="whitespace-nowrap">
                        {formatDateTime(login.createdAt, locale)}
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-1.5">
                          {login.success ? (
                            <CheckCircle2 aria-hidden className="text-success size-4" />
                          ) : (
                            failIcon
                          )}
                          {outcome(login)}
                        </span>
                      </TD>
                      <TD muted className="tabular-nums">
                        {login.ip ?? '—'}
                      </TD>
                      <TD muted className="max-w-xs truncate text-xs">
                        {login.userAgent ?? '—'}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <Pagination
                basePath={basePath}
                query={query}
                next={logins.next}
                prev={logins.prev}
                count={logins.rows.length}
                prefix={LOGIN}
              />
            </>
          )}
        </section>
      )}
    </Page>
  );
}
