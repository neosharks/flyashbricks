'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import { setLocale } from '@/features/auth/actions';
import { cn } from '@/lib/utils';

/** English ⇄ हिन्दी. Saved in a cookie, so it sticks on this device. */
export function LanguageSwitch({ className }: { className?: string }) {
  const t = useTranslations('common.language');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = locale === 'hi' ? 'en' : 'hi';

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setLocale(next);
          router.refresh();
        })
      }
      className={cn(
        'border-border text-foreground-muted hover:text-foreground inline-flex min-h-10 items-center gap-1.5 rounded-md border px-2.5 text-sm disabled:opacity-60',
        className,
      )}
      aria-label={`${t('label')}: ${t(next)}`}
      lang={next}
    >
      <Languages aria-hidden className="size-4" />
      {t(next)}
    </button>
  );
}
