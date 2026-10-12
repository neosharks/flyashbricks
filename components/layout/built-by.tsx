import { getTranslations } from 'next-intl/server';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

export const NEOSHARKS_URL = 'https://www.neosharks.in/';

/** Maker's credit for the public pages: the landing page and sign-in. */
export async function BuiltBy({ className }: { className?: string }) {
  const t = await getTranslations('common');
  return (
    <p className={cn('inline-flex flex-wrap items-center justify-center gap-1', className)}>
      {t.rich('credit', {
        heart: () => (
          <Heart
            role="img"
            aria-label={t('creditHeart')}
            className="text-danger size-3.5 fill-current"
          />
        ),
        link: (chunks) => (
          <a
            href={NEOSHARKS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            {chunks}
          </a>
        ),
      })}
    </p>
  );
}
