'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dismissPinOffer } from '@/features/auth/actions';

/** Shown once after a password sign-in on a device without a PIN. Never in the way. */
export function PinOffer() {
  const t = useTranslations('auth.quickPin');
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  if (hidden) return null;

  return (
    <section
      aria-labelledby="pin-offer"
      className="border-action/30 bg-action-subtle flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
    >
      <KeyRound aria-hidden className="text-action size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 id="pin-offer" className="font-semibold">
          {t('offerTitle')}
        </h2>
        <p className="text-foreground-muted text-sm">{t('offerBody')}</p>
      </div>
      <div className="flex gap-2">
        <Button asChild size="sm">
          <Link href="/account#quick-sign-in">{t('offerSetUp')}</Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              await dismissPinOffer();
              setHidden(true);
            })
          }
        >
          {t('offerDismiss')}
        </Button>
      </div>
    </section>
  );
}
