import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  Building2,
  DatabaseBackup,
  History,
  KeyRound,
  LogOut,
  Server,
  ShieldBan,
  UserCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { CtaBand, SectionHeading } from '@/components/marketing/sections';
import { asSiteLocale, siteMetadata, sitePath } from '@/components/marketing/site';
import { SiteShell } from '@/components/marketing/site-shell';

const ITEMS: { key: string; icon: LucideIcon }[] = [
  { key: 'access', icon: UserCheck },
  { key: 'company', icon: Building2 },
  { key: 'logins', icon: KeyRound },
  { key: 'sessions', icon: LogOut },
  { key: 'attempts', icon: ShieldBan },
  { key: 'activity', icon: History },
  { key: 'backups', icon: DatabaseBackup },
  { key: 'hosting', icon: Server },
];

export async function generateMetadata(): Promise<Metadata> {
  return siteMetadata(asSiteLocale(await getLocale()), 'security');
}

export default async function SecurityPage() {
  const [t, rawLocale] = await Promise.all([getTranslations('marketing'), getLocale()]);
  const locale = asSiteLocale(rawLocale);

  return (
    <SiteShell locale={locale} page="security">
      <section className="from-success-subtle to-canvas bg-linear-to-b px-4 pt-12 pb-10 sm:pt-20">
        <SectionHeading
          as="h1"
          eyebrow={t('security.eyebrow')}
          title={t('security.title')}
          subtitle={t('security.subtitle')}
        />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:pb-24">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ key, icon: Icon }) => (
            <li key={key} className="border-border bg-surface rounded-2xl border p-6 shadow-sm">
              <span className="bg-success-subtle text-success inline-flex rounded-xl p-2.5">
                <Icon aria-hidden className="size-5" />
              </span>
              <h2 className="mt-4 font-semibold">{t(`security.items.${key}.title`)}</h2>
              <p className="text-foreground-muted mt-1.5 text-sm">
                {t(`security.items.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>

        <div className="border-border bg-surface mx-auto mt-12 max-w-3xl rounded-2xl border p-6 sm:p-8">
          <h2 className="text-xl font-bold">{t('security.neverTitle')}</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {(t.raw('security.never') as string[]).map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <XCircle aria-hidden className="text-danger mt-0.5 size-5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand
        title={t('cta.title')}
        body={t('cta.body')}
        primary={{ label: t('cta.primary'), href: sitePath(locale, 'contact') }}
        secondary={{ label: t('cta.secondary'), href: '/login' }}
      />
    </SiteShell>
  );
}
