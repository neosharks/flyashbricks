import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BrowserFrame, PhoneFrame } from './frames';
import { shot, type SiteLocale } from './site';

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  as: Heading = 'h2',
  align = 'center',
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  as?: 'h1' | 'h2';
  align?: 'center' | 'start';
}) {
  return (
    <div className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow && (
        <p className="text-action text-sm font-semibold tracking-wide uppercase">{eyebrow}</p>
      )}
      <Heading
        className={cn(
          'mt-2 font-bold tracking-tight text-balance',
          Heading === 'h1'
            ? 'text-3xl sm:text-4xl lg:text-5xl'
            : 'text-2xl sm:text-3xl lg:text-4xl',
        )}
      >
        {title}
      </Heading>
      {subtitle && (
        <p className="text-foreground-muted mt-4 text-base text-pretty sm:text-lg">{subtitle}</p>
      )}
    </div>
  );
}

export function CheckList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-2.5', className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <CheckCircle2 aria-hidden className="text-success mt-0.5 size-5 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The same screen on a computer and on a phone. Phones see only the phone
 * picture, at a size that can actually be read.
 */
export function DeviceDuo({
  locale,
  name,
  alt,
  preload = false,
  dark = false,
}: {
  locale: SiteLocale;
  name: string;
  alt: string;
  preload?: boolean;
  dark?: boolean;
}) {
  return (
    <div className="relative pb-6 sm:pb-10">
      <BrowserFrame
        image={{ ...shot(locale, name, 'desktop', dark), alt }}
        preload={preload}
        className="hidden sm:mr-14 sm:block lg:mr-20"
      />
      <PhoneFrame
        image={{ ...shot(locale, name, 'mobile', dark), alt }}
        preload={preload}
        sizes="(min-width: 1024px) 11rem, (min-width: 640px) 9rem, 15rem"
        className="mx-auto w-60 sm:absolute sm:right-0 sm:bottom-0 sm:w-36 lg:w-44"
      />
    </div>
  );
}

export function FeatureRow({
  locale,
  name,
  eyebrow,
  title,
  body,
  points,
  alt,
  flip = false,
}: {
  locale: SiteLocale;
  name: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  alt: string;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={cn(flip && 'lg:order-2')}>
        <p className="text-action text-sm font-semibold tracking-wide uppercase">{eyebrow}</p>
        <h3 className="mt-2 text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h3>
        <p className="text-foreground-muted mt-4 text-base sm:text-lg">{body}</p>
        <CheckList items={points} className="mt-6 text-sm sm:text-base" />
      </div>
      <div className={cn(flip && 'lg:order-1')}>
        <DeviceDuo locale={locale} name={name} alt={alt} />
      </div>
    </div>
  );
}

export function CtaBand({
  title,
  body,
  primary,
  secondary,
}: {
  title: string;
  body: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}) {
  return (
    <section className="px-4 py-16 sm:py-20">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[oklch(24%_0.03_190)] px-6 py-12 text-center text-white sm:px-12 sm:py-16">
        <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.08]">
          <defs>
            <pattern id="cta-bond" width="72" height="36" patternUnits="userSpaceOnUse">
              <path d="M0 .5h72M0 18.5h72M.5 0v18M36.5 18v18" stroke="white" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cta-bond)" />
        </svg>
        <div className="relative">
          <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/75 sm:text-lg">{body}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={primary.href}>{primary.label}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
            >
              <Link href={secondary.href}>{secondary.label}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
