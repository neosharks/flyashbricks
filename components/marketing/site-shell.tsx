import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Languages, Menu } from 'lucide-react';
import { BuiltBy, NEOSHARKS_URL } from '@/components/layout/built-by';
import { Button } from '@/components/ui/button';
import { publicEnv } from '@/lib/public-env';
import { cn } from '@/lib/utils';
import { sitePath, type SiteLocale, type SitePage } from './site';

const NAV: SitePage[] = ['features', 'security', 'contact'];

function Logo({ locale }: { locale: SiteLocale }) {
  return (
    <Link href={sitePath(locale, 'home')} className="flex shrink-0 items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- a 2KB static SVG */}
      <img src="/icon.svg" alt="" width={32} height={32} className="size-8 rounded-lg" />
      <span className="text-sm font-semibold sm:text-base">{publicEnv.NEXT_PUBLIC_APP_NAME}</span>
    </Link>
  );
}

/**
 * Header, footer and language for one page of the public website. Each page
 * has a fixed language, so the language link goes to the same page in the
 * other one rather than setting a preference.
 */
export async function SiteShell({
  locale,
  page,
  children,
}: {
  locale: SiteLocale;
  page: SitePage;
  children: React.ReactNode;
}) {
  const t = await getTranslations('marketing');
  const other: SiteLocale = locale === 'hi' ? 'en' : 'hi';
  const navLabel = (item: SitePage) => t(`nav.${item}`);

  return (
    <div className="bg-canvas flex min-h-dvh flex-col" lang={locale}>
      <header className="border-border bg-surface/85 sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <nav
          aria-label={t('nav.label')}
          className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4"
        >
          <Logo locale={locale} />

          <ul className="ml-6 hidden items-center gap-1 text-sm md:flex">
            {NAV.map((item) => (
              <li key={item}>
                <Link
                  href={sitePath(locale, item)}
                  aria-current={item === page ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-2 font-medium transition-colors',
                    item === page
                      ? 'text-foreground bg-surface-muted'
                      : 'text-foreground-muted hover:text-foreground',
                  )}
                >
                  {navLabel(item)}
                </Link>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Link
              href={sitePath(other, page)}
              hrefLang={other === 'hi' ? 'hi-IN' : 'en-IN'}
              lang={other}
              className="text-foreground-muted hover:text-foreground hover:bg-surface-muted inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium"
            >
              <Languages aria-hidden className="size-4" />
              {t('nav.language')}
            </Link>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">{t('nav.signIn')}</Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href={sitePath(locale, 'contact')}>{t('nav.demo')}</Link>
            </Button>

            {/* A plain disclosure: the menu works before any script loads. */}
            <details className="group relative md:hidden">
              <summary
                aria-label={t('nav.menu')}
                className="hover:bg-surface-muted flex size-11 cursor-pointer list-none items-center justify-center rounded-md [&::-webkit-details-marker]:hidden"
              >
                <Menu aria-hidden className="size-5" />
              </summary>
              <div className="border-border bg-surface absolute top-full right-0 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border p-2 shadow-xl">
                <ul className="flex flex-col">
                  {(['home', ...NAV] as SitePage[]).map((item) => (
                    <li key={item}>
                      <Link
                        href={sitePath(locale, item)}
                        aria-current={item === page ? 'page' : undefined}
                        className={cn(
                          'flex min-h-11 items-center rounded-md px-3 text-base font-medium',
                          item === page ? 'bg-surface-muted' : 'hover:bg-surface-muted',
                        )}
                      >
                        {navLabel(item)}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="border-border mt-2 grid gap-2 border-t pt-3">
                  <Button asChild full>
                    <Link href={sitePath(locale, 'contact')}>{t('nav.demo')}</Link>
                  </Button>
                  <Button asChild variant="outline" full>
                    <Link href="/login">{t('nav.signIn')}</Link>
                  </Button>
                </div>
              </div>
            </details>
          </div>
        </nav>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-border bg-surface border-t pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Logo locale={locale} />
            <p className="text-foreground-muted max-w-sm text-sm">{t('footer.tagline')}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t('footer.product')}</h2>
            <ul className="text-foreground-muted mt-3 flex flex-col gap-2 text-sm">
              {(['features', 'security'] as const).map((item) => (
                <li key={item}>
                  <Link href={sitePath(locale, item)} className="hover:text-foreground">
                    {navLabel(item)}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={sitePath(locale, 'home', '#faq')} className="hover:text-foreground">
                  {t('nav.faq')}
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-foreground">
                  {t('nav.signIn')}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t('footer.company')}</h2>
            <ul className="text-foreground-muted mt-3 flex flex-col gap-2 text-sm">
              <li>
                <Link href={sitePath(locale, 'contact')} className="hover:text-foreground">
                  {t('nav.contact')}
                </Link>
              </li>
              <li>
                <a
                  href={NEOSHARKS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  NeoSharks
                </a>
              </li>
              <li>
                <Link href={sitePath(other, page)} lang={other} className="hover:text-foreground">
                  {t('nav.language')}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-border text-foreground-muted border-t">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs sm:flex-row">
            <p>{t('footer.rights', { year: new Date().getFullYear() })}</p>
            <BuiltBy />
          </div>
        </div>
      </footer>
    </div>
  );
}
