import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  Activity,
  BarChart3,
  BellRing,
  Boxes,
  CalendarCheck,
  Contrast,
  DatabaseBackup,
  Factory,
  FlaskConical,
  HandCoins,
  KeyRound,
  Languages,
  Package,
  ReceiptIndianRupee,
  ScrollText,
  Smartphone,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { PhoneFrame } from '@/components/marketing/frames';
import { CtaBand, DeviceDuo, SectionHeading } from '@/components/marketing/sections';
import { asSiteLocale, shot, siteMetadata, sitePath } from '@/components/marketing/site';
import { SiteShell } from '@/components/marketing/site-shell';

type Group = {
  key: 'manufacturing' | 'selling' | 'people' | 'control' | 'everyone';
  shot: string;
  items: { key: string; icon: LucideIcon }[];
};

const GROUPS: Group[] = [
  {
    key: 'manufacturing',
    shot: 'material',
    items: [
      { key: 'materials', icon: Package },
      { key: 'recipe', icon: FlaskConical },
      { key: 'production', icon: Factory },
      { key: 'stock', icon: Boxes },
    ],
  },
  {
    key: 'selling',
    shot: 'sale',
    items: [
      { key: 'sales', icon: ReceiptIndianRupee },
      { key: 'invoices', icon: ScrollText },
      { key: 'customers', icon: Users },
      { key: 'dues', icon: HandCoins },
    ],
  },
  {
    key: 'people',
    shot: 'staff',
    items: [
      { key: 'attendance', icon: CalendarCheck },
      { key: 'wages', icon: Wallet },
      { key: 'logins', icon: KeyRound },
    ],
  },
  {
    key: 'control',
    shot: 'notifications',
    items: [
      { key: 'dashboard', icon: BarChart3 },
      { key: 'alerts', icon: BellRing },
      { key: 'activity', icon: Activity },
      { key: 'backups', icon: DatabaseBackup },
    ],
  },
  {
    key: 'everyone',
    shot: 'dashboard',
    items: [
      { key: 'languages', icon: Languages },
      { key: 'phone', icon: Smartphone },
      { key: 'comfort', icon: Contrast },
    ],
  },
];

export async function generateMetadata(): Promise<Metadata> {
  return siteMetadata(asSiteLocale(await getLocale()), 'features');
}

export default async function FeaturesPage() {
  const [t, rawLocale] = await Promise.all([getTranslations('marketing'), getLocale()]);
  const locale = asSiteLocale(rawLocale);

  return (
    <SiteShell locale={locale} page="features">
      <section className="from-action-subtle to-canvas bg-linear-to-b px-4 pt-12 pb-10 sm:pt-20">
        <SectionHeading
          as="h1"
          eyebrow={t('features.eyebrow')}
          title={t('features.title')}
          subtitle={t('features.subtitle')}
        />
        <nav aria-label={t('features.jump')} className="mx-auto mt-8 max-w-3xl">
          <ul className="flex flex-wrap justify-center gap-2">
            {GROUPS.map((group) => (
              <li key={group.key}>
                <Link
                  href={`#${group.key}`}
                  className="border-border bg-surface hover:border-action hover:text-action inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium"
                >
                  {t(`features.groups.${group.key}.title`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      {GROUPS.map((group, index) => (
        <section
          key={group.key}
          id={group.key}
          aria-labelledby={`${group.key}-title`}
          className={
            index % 2 === 0
              ? 'scroll-mt-16 py-16 sm:py-20'
              : 'bg-surface border-border scroll-mt-16 border-y py-16 sm:py-20'
          }
        >
          <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div className={index % 2 === 1 ? 'lg:order-2' : undefined}>
              <h2
                id={`${group.key}-title`}
                className="text-2xl font-bold tracking-tight sm:text-3xl"
              >
                {t(`features.groups.${group.key}.title`)}
              </h2>
              <p className="text-foreground-muted mt-2 text-base sm:text-lg">
                {t(`features.groups.${group.key}.body`)}
              </p>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                {group.items.map(({ key, icon: Icon }) => (
                  <li
                    key={key}
                    className="border-border bg-canvas rounded-2xl border p-5 shadow-sm"
                  >
                    <span className="bg-action-subtle text-action inline-flex rounded-xl p-2.5">
                      <Icon aria-hidden className="size-5" />
                    </span>
                    <h3 className="mt-3 font-semibold">{t(`features.items.${key}.title`)}</h3>
                    <p className="text-foreground-muted mt-1 text-sm">
                      {t(`features.items.${key}.body`)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div
              className={index % 2 === 1 ? 'lg:sticky lg:top-24 lg:order-1' : 'lg:sticky lg:top-24'}
            >
              {group.key === 'everyone' ? (
                // The Hindi screen, whatever the page language: that is the point.
                <PhoneFrame
                  image={{
                    ...shot('hi', group.shot, 'mobile'),
                    alt: t(`features.groups.${group.key}.alt`),
                  }}
                  sizes="18rem"
                  className="mx-auto w-64 sm:w-72"
                />
              ) : (
                <DeviceDuo
                  locale={locale}
                  name={group.shot}
                  alt={t(`features.groups.${group.key}.alt`)}
                />
              )}
            </div>
          </div>
        </section>
      ))}

      <CtaBand
        title={t('cta.title')}
        body={t('cta.body')}
        primary={{ label: t('cta.primary'), href: sitePath(locale, 'contact') }}
        secondary={{ label: t('cta.secondary'), href: '/login' }}
      />
    </SiteShell>
  );
}
