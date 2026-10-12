import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { CalendarClock, Download, History, LifeBuoy, Mail, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
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
import { BACKUP_HISTORY_SORTS, getBackupOverview, listBackupPage } from '@/features/backup/queries';
import { parseTableParams } from '@/lib/table';
import { env } from '@/lib/env';
import { requirePermissionPage } from '@/lib/session';
import { formatDateTime } from '@/lib/utils';
import { DownloadBackupForm } from '@/components/backup/download-backup-form';
import { EmailBackupForm } from '@/components/backup/email-backup-form';
import { Page } from '@/components/ui/page';

export const metadata: Metadata = { title: 'Backup' };

/**
 * Kept deliberately plain: the people running a brick yard should be able to
 * take a backup without knowing what encryption is. Technical detail lives in
 * docs/backup.md.
 */
type SearchParams = Record<string, string | string[] | undefined>;

export default async function BackupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermissionPage('/backup', 'backup:run');
  const query = await searchParams;
  const table = parseTableParams(
    query,
    BACKUP_HISTORY_SORTS,
    { sort: 'createdAt', dir: 'desc', size: 10 },
    'hist_',
  );
  const [t, locale, overview, history] = await Promise.all([
    getTranslations('backup'),
    getLocale(),
    getBackupOverview(viewer.orgId, viewer.id),
    listBackupPage(viewer.orgId, table),
  ]);

  const automaticOn =
    Boolean(env.BACKUP_PASSPHRASE) && (Boolean(env.BACKUP_DIR) || env.BACKUP_EMAIL_TO.length > 0);
  const lastBackup = overview.history[0];
  const lastAutomatic = overview.history.find((row) => row.action === 'backup.scheduled');
  const typeKey = (action: string) =>
    action === 'backup.email' ? 'email' : action === 'backup.scheduled' ? 'scheduled' : 'download';

  return (
    <Page size="medium">
      <PageHeader title={t('title')} description={t('description')} />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label={t('lastBackup')}
          value={lastBackup ? formatDateTime(lastBackup.createdAt, locale) : t('lastBackupNever')}
          hint={t('lastBackupHint')}
          icon={History}
          tone={lastBackup ? 'success' : 'warning'}
        />
        <StatCard
          label={t('automatic.title')}
          value={automaticOn ? t('automatic.on') : t('automatic.off')}
          hint={
            automaticOn
              ? `${t('automatic.lastRun')}: ${lastAutomatic ? formatDateTime(lastAutomatic.createdAt, locale) : t('automatic.never')}`
              : t('automatic.offBody')
          }
          icon={CalendarClock}
          tone={automaticOn ? 'success' : 'neutral'}
        />
      </div>

      <p className="text-foreground-muted mb-6 flex gap-2 text-sm">
        <ShieldCheck aria-hidden className="text-action mt-0.5 size-4 shrink-0" />
        {t('whatBody')}
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download aria-hidden className="text-action size-5" />
              {t('download.title')}
            </CardTitle>
            <p className="text-foreground-muted text-sm">{t('download.description')}</p>
          </CardHeader>
          <CardBody>
            <DownloadBackupForm />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail aria-hidden className="text-action size-5" />
              {t('email.title')}
            </CardTitle>
            <p className="text-foreground-muted text-sm">{t('email.description')}</p>
          </CardHeader>
          <CardBody>
            <EmailBackupForm defaultTo={overview.adminEmail ?? ''} />
          </CardBody>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">{t('history.title')}</h2>
        {history.rows.length === 0 ? (
          <p className="text-foreground-muted text-sm">{t('history.empty')}</p>
        ) : (
          <>
            <Table caption={t('history.title')} minWidth="28rem">
              <THead>
                <SortableTH
                  column="createdAt"
                  label={t('history.when')}
                  sort={table.sort}
                  dir={table.dir}
                  basePath="/backup"
                  query={query}
                  defaultDir="desc"
                  prefix="hist_"
                />
                <TH>{t('history.type')}</TH>
                <TH>{t('history.who')}</TH>
                <TH>{t('history.locked')}</TH>
              </THead>
              <TBody>
                {history.rows.map((row) => (
                  <TR key={row.id}>
                    <TD muted className="whitespace-nowrap">
                      {formatDateTime(row.createdAt, locale)}
                    </TD>
                    <TD>{t(`history.types.${typeKey(row.action)}`)}</TD>
                    <TD>{row.actorName ?? t('history.automatic')}</TD>
                    <TD>
                      <Badge tone={row.encrypted ? 'success' : 'warning'}>
                        {row.encrypted ? t('history.lockedYes') : t('history.lockedNo')}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              basePath="/backup"
              query={query}
              next={history.next}
              prev={history.prev}
              count={history.rows.length}
              prefix="hist_"
            />
          </>
        )}
      </section>

      <p className="text-foreground-muted mt-8 flex gap-2 text-sm">
        <LifeBuoy aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong className="text-foreground">{t('helpTitle')}</strong> {t('helpBody')}
        </span>
      </p>
    </Page>
  );
}
