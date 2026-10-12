import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowUpRight, Globe, Mail } from 'lucide-react';
import { FactoryScene } from '@/components/illustrations';
import { CheckList, SectionHeading } from '@/components/marketing/sections';
import {
  asSiteLocale,
  CONTACT_EMAIL,
  NEOSHARKS_CONTACT_URL,
  siteMetadata,
} from '@/components/marketing/site';
import { SiteShell } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  return siteMetadata(asSiteLocale(await getLocale()), 'contact');
}

/**
 * Demo requests go to the team by email. There is deliberately no form here:
 * nothing to spam, and no personal details stored by the app itself.
 */
export default async function ContactPage() {
  const [t, rawLocale] = await Promise.all([getTranslations('marketing'), getLocale()]);
  const locale = asSiteLocale(rawLocale);
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t('contact.emailSubject'))}`;

  return (
    <SiteShell locale={locale} page="contact">
      <section className="from-action-subtle to-canvas bg-linear-to-b px-4 pt-12 pb-10 sm:pt-20">
        <SectionHeading
          as="h1"
          eyebrow={t('contact.eyebrow')}
          title={t('contact.title')}
          subtitle={t('contact.subtitle')}
        />
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 sm:pb-24 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="border-border bg-surface rounded-2xl border p-6 shadow-sm sm:p-8">
            <span className="bg-action-subtle text-action inline-flex rounded-xl p-2.5">
              <Mail aria-hidden className="size-6" />
            </span>
            <h2 className="mt-4 text-xl font-bold">{t('contact.emailTitle')}</h2>
            <p className="text-foreground-muted mt-1">{t('contact.emailBody')}</p>
            <Button asChild size="lg" className="mt-5 w-full sm:w-auto">
              <a href={mailto}>
                <Mail aria-hidden />
                {CONTACT_EMAIL}
              </a>
            </Button>
          </div>

          <div className="border-border bg-surface rounded-2xl border p-6 shadow-sm sm:p-8">
            <span className="bg-surface-muted inline-flex rounded-xl p-2.5">
              <Globe aria-hidden className="size-6" />
            </span>
            <h2 className="mt-4 text-xl font-bold">{t('contact.websiteTitle')}</h2>
            <p className="text-foreground-muted mt-1">{t('contact.websiteBody')}</p>
            <Button asChild size="lg" variant="outline" className="mt-5 w-full sm:w-auto">
              <a href={NEOSHARKS_CONTACT_URL} target="_blank" rel="noopener noreferrer">
                {t('contact.websiteLink')}
                <ArrowUpRight aria-hidden />
              </a>
            </Button>
          </div>

          <p className="text-foreground-muted px-1 text-sm">
            {t('contact.already')}{' '}
            <Link href="/login" className="text-action font-semibold hover:underline">
              {t('contact.signIn')}
            </Link>
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="border-border bg-surface rounded-2xl border p-6 sm:p-8">
            <h2 className="text-lg font-semibold">{t('contact.includeTitle')}</h2>
            <CheckList items={t.raw('contact.include') as string[]} className="mt-4" />
          </div>
          <div className="border-border bg-surface rounded-2xl border p-6 sm:p-8">
            <h2 className="text-lg font-semibold">{t('contact.nextTitle')}</h2>
            <ol className="mt-4 flex flex-col gap-3">
              {(t.raw('contact.next') as string[]).map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="bg-action text-action-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <FactoryScene className="h-auto w-full" />
        </div>
      </section>
    </SiteShell>
  );
}
