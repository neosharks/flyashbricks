import { getTranslations } from 'next-intl/server';
import { CheckCircle2, Lock } from 'lucide-react';
import { LanguageSwitch } from '@/components/layout/language-switch';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { BrandMark } from '@/components/layout/brand-mark';
import { BuiltBy } from '@/components/layout/built-by';

/**
 * Sign-in and first-password screens. A split layout on wide screens: a quiet
 * brand panel on the left, the form on the right with nothing competing for
 * attention. Phones get only the form.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [t, ta] = await Promise.all([getTranslations('common'), getTranslations('auth')]);
  const points = ta.raw('panel.points') as string[];

  return (
    <div className="flex min-h-dvh">
      <aside className="relative hidden w-[44%] max-w-2xl flex-col justify-between overflow-hidden bg-[oklch(21%_0.02_200)] p-12 text-white lg:flex">
        {/* A faint brick-bond texture: the trade, without decoration for its own sake. */}
        <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.07]">
          <defs>
            <pattern id="bond" width="72" height="36" patternUnits="userSpaceOnUse">
              <path d="M0 .5h72M0 18.5h72M.5 0v18M36.5 18v18" stroke="white" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bond)" />
        </svg>
        <div
          aria-hidden
          className="absolute -right-32 -bottom-32 size-96 rounded-full bg-[oklch(60%_0.11_175)] opacity-20 blur-3xl"
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a 2KB static SVG */}
            <img src="/icon.svg" alt="" width={36} height={36} className="size-9 rounded-lg" />
            <span className="text-lg font-semibold tracking-tight">{t('appName')}</span>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">
            {ta('panel.headline')}
          </h2>
          <p className="mt-4 text-base text-white/70">{ta('panel.body')}</p>
          <ul className="mt-8 flex flex-col gap-3">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-3 text-sm text-white/85">
                <CheckCircle2 aria-hidden className="size-5 shrink-0 text-[oklch(78%_0.11_175)]" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-white/50">
          <Lock aria-hidden className="size-3.5" />
          {ta('panel.secure')}
        </p>
      </aside>

      <div className="bg-surface flex flex-1 flex-col pt-[env(safe-area-inset-top)]">
        <header className="flex items-center justify-between gap-3 px-6 py-4">
          <div className="lg:invisible">
            <BrandMark name={t('appName')} />
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main
          id="main"
          className="flex flex-1 items-start justify-center px-6 pt-8 pb-12 sm:items-center sm:pt-0"
        >
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <footer className="text-foreground-subtle flex flex-col items-center gap-2 px-6 pb-6 text-xs">
          <div className="mb-2 sm:hidden">
            <ThemeToggle />
          </div>
          <p className="flex items-center gap-1.5 lg:hidden">
            <Lock aria-hidden className="size-3" />
            {ta('panel.secure')}
          </p>
          <BuiltBy />
        </footer>
      </div>
    </div>
  );
}
