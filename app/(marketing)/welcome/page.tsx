import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { BrickPress, DeliveryTruck, Worker } from '@/components/illustrations';
import { PhoneFrame } from '@/components/marketing/frames';
import {
  CheckList,
  CtaBand,
  DeviceDuo,
  FeatureRow,
  SectionHeading,
} from '@/components/marketing/sections';
import { asSiteLocale, shot, siteMetadata, sitePath } from '@/components/marketing/site';
import { SiteShell } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';
import { publicEnv } from '@/lib/public-env';

/**
 * The public home page and the main page meant for search engines. Served at
 * `/` (English) and `/hi` (Hindi) by proxy.ts; each address has one fixed
 * language, its own title and description, and hreflang links to the other.
 */

const SHOWCASE = ['dashboard', 'sales', 'materials', 'production', 'staff', 'invoice'] as const;
/** Which screenshot illustrates each showcase row. */
const SHOWCASE_SHOT: Record<(typeof SHOWCASE)[number], string> = {
  dashboard: 'dashboard',
  sales: 'sales',
  materials: 'materials',
  production: 'production',
  staff: 'attendance',
  invoice: 'invoice',
};
const STEPS = ['one', 'two', 'three'] as const;
const FAQ = ['hindi', 'gst', 'phone', 'labour', 'many', 'data', 'price'] as const;

export async function generateMetadata(): Promise<Metadata> {
  return siteMetadata(asSiteLocale(await getLocale()), 'home');
}

/** Structured data: what the product is, and the FAQ, for rich results. */
async function jsonLd(locale: 'en' | 'hi') {
  const t = await getTranslations('marketing');
  const url = new URL(sitePath(locale, 'home'), publicEnv.APP_URL).toString();
  const language = locale === 'hi' ? 'hi-IN' : 'en-IN';
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: publicEnv.NEXT_PUBLIC_APP_NAME,
      url,
      inLanguage: language,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Android, iOS',
      description: t('meta.home.description'),
      areaServed: { '@type': 'Country', name: 'India' },
      availableLanguage: ['en', 'hi'],
      screenshot: new URL(shot(locale, 'dashboard', 'desktop').src, url).toString(),
      creator: { '@type': 'Organization', name: 'NeoSharks', url: 'https://www.neosharks.in/' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: language,
      mainEntity: FAQ.map((key) => ({
        '@type': 'Question',
        name: t(`faq.${key}.q`),
        acceptedAnswer: { '@type': 'Answer', text: t(`faq.${key}.a`) },
      })),
    },
  ];
  // `<` is escaped so the JSON can never close the script element early.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export default async function HomePage() {
  const [t, rawLocale] = await Promise.all([getTranslations('marketing'), getLocale()]);
  const locale = asSiteLocale(rawLocale);
  const facts = t.raw('facts') as { value: string; label: string }[];

  return (
    <SiteShell locale={locale} page="home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: await jsonLd(locale) }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="from-action-subtle via-canvas to-canvas absolute inset-0 bg-linear-to-b"
        />
        <div
          aria-hidden
          className="bg-action/20 absolute -top-40 -right-40 size-[32rem] rounded-full blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-12 sm:pt-16 lg:grid-cols-[1fr_1.15fr] lg:gap-10 lg:pt-20 lg:pb-20">
          <div className="text-center lg:text-left">
            <p className="border-action/30 bg-surface/70 text-action inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold sm:text-sm">
              <span aria-hidden className="bg-action size-1.5 rounded-full" />
              {t('hero.eyebrow')}
            </p>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {t('hero.title')}
            </h1>
            <p className="text-foreground-muted mx-auto mt-5 max-w-xl text-lg text-pretty lg:mx-0">
              {t('hero.subtitle')}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Button asChild size="lg">
                <Link href={sitePath(locale, 'contact')}>
                  {t('hero.primary')}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={sitePath(locale, 'features')}>{t('hero.secondary')}</Link>
              </Button>
            </div>
            <ul className="text-foreground-muted mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm lg:justify-start">
              {(t.raw('hero.points') as string[]).map((point) => (
                <li key={point} className="flex items-center gap-1.5">
                  <CheckCircle2 aria-hidden className="text-success size-4" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <DeviceDuo locale={locale} name="dashboard" alt={t('hero.desktopAlt')} preload />
        </div>
      </section>

      {/* Facts */}
      <section aria-label={t('hero.eyebrow')} className="mx-auto max-w-6xl px-4">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {facts.map((fact) => (
            <li
              key={fact.label}
              className="border-border bg-surface rounded-2xl border p-4 text-center shadow-sm sm:p-6"
            >
              <p className="text-action text-2xl font-extrabold sm:text-3xl">{fact.value}</p>
              <p className="text-foreground-muted mt-1 text-sm">{fact.label}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Before and after */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <SectionHeading title={t('pain.title')} subtitle={t('pain.subtitle')} />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="border-border bg-surface rounded-2xl border p-6 sm:p-8">
            <h3 className="text-foreground-muted text-lg font-semibold">{t('pain.beforeTitle')}</h3>
            <ul className="mt-5 flex flex-col gap-3">
              {(t.raw('pain.before') as string[]).map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <XCircle aria-hidden className="text-danger mt-0.5 size-5 shrink-0" />
                  <span className="text-foreground-muted">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-success/40 bg-success-subtle rounded-2xl border p-6 sm:p-8">
            <h3 className="text-success text-lg font-semibold">{t('pain.afterTitle')}</h3>
            <CheckList items={t.raw('pain.after') as string[]} className="mt-5" />
          </div>
        </div>
      </section>

      {/* Showcase */}
      <section id="tour" className="bg-surface border-border scroll-mt-16 border-y py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading title={t('showcase.title')} subtitle={t('showcase.subtitle')} />
          <div className="mt-16 flex flex-col gap-20 sm:gap-28">
            {SHOWCASE.map((key, index) => (
              <FeatureRow
                key={key}
                locale={locale}
                name={SHOWCASE_SHOT[key]}
                eyebrow={t(`showcase.${key}.eyebrow`)}
                title={t(`showcase.${key}.title`)}
                body={t(`showcase.${key}.body`)}
                points={t.raw(`showcase.${key}.points`) as string[]}
                alt={t(`showcase.${key}.alt`)}
                flip={index % 2 === 1}
              />
            ))}
          </div>
          <div className="mt-16 text-center">
            <Button asChild size="lg" variant="outline">
              <Link href={sitePath(locale, 'features')}>
                {t('hero.secondary')}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Two languages */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <SectionHeading title={t('languages.title')} subtitle={t('languages.body')} />
        <div className="mt-12 flex items-start justify-center gap-4 sm:gap-10">
          {(['en', 'hi'] as const).map((language, index) => (
            <figure key={language} className={index === 1 ? 'mt-10' : undefined}>
              <PhoneFrame
                image={{
                  ...shot(language, 'sale-new', 'mobile'),
                  alt: t(language === 'en' ? 'languages.altEn' : 'languages.altHi'),
                }}
                sizes="(min-width: 640px) 16rem, 45vw"
                className="w-[42vw] max-w-64"
              />
              <figcaption lang={language} className="mt-4 text-center text-sm font-semibold">
                {t(`languages.${language}`)}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Phone first, dark mode */}
      <section className="bg-surface border-border border-y py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-[1fr_auto] lg:gap-20">
          <div>
            <SectionHeading align="start" title={t('mobile.title')} subtitle={t('mobile.body')} />
            <CheckList items={t.raw('mobile.points') as string[]} className="mt-6" />
          </div>
          <PhoneFrame
            image={{ ...shot(locale, 'dashboard', 'mobile', true), alt: t('mobile.alt') }}
            sizes="18rem"
            className="mx-auto w-64 sm:w-72"
          />
        </div>
      </section>

      {/* Security teaser */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="border-border bg-surface grid gap-8 rounded-3xl border p-6 shadow-sm sm:p-10 md:grid-cols-[auto_1fr] md:items-center">
          <span className="bg-success-subtle text-success inline-flex size-16 items-center justify-center rounded-2xl">
            <ShieldCheck aria-hidden className="size-8" />
          </span>
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('trust.title')}</h2>
            <p className="text-foreground-muted mt-3 text-base sm:text-lg">{t('trust.body')}</p>
            <CheckList
              items={t.raw('trust.points') as string[]}
              className="mt-5 sm:grid sm:grid-cols-3 sm:gap-4"
            />
            <Link
              href={sitePath(locale, 'security')}
              className="text-action mt-6 inline-flex min-h-11 items-center gap-1.5 font-semibold hover:underline"
            >
              {t('trust.link')}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-surface border-border border-y py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading title={t('how.title')} />
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => {
              const Art = [BrickPress, Worker, DeliveryTruck][index] ?? BrickPress;
              return (
                <li key={step} className="border-border bg-canvas rounded-2xl border p-6">
                  <div className="flex h-28 items-end justify-center">
                    <Art className="h-full w-auto" />
                  </div>
                  <p className="bg-action text-action-foreground mt-5 inline-flex size-8 items-center justify-center rounded-full text-sm font-bold">
                    {index + 1}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold">{t(`how.${step}.title`)}</h3>
                  <p className="text-foreground-muted mt-1">{t(`how.${step}.body`)}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Questions */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-16 px-4 py-16 sm:py-24">
        <SectionHeading title={t('faq.title')} />
        <div className="divide-border border-border bg-surface mt-10 divide-y rounded-2xl border">
          {FAQ.map((key) => (
            <details key={key} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
                <h3>{t(`faq.${key}.q`)}</h3>
                <span
                  aria-hidden
                  className="text-foreground-muted text-xl transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="text-foreground-muted px-5 pb-5">{t(`faq.${key}.a`)}</p>
            </details>
          ))}
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
