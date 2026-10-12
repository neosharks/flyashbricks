'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/alert';
import { BrickLoader } from '@/components/ui/brick-loader';
import { openNotification } from '@/features/notifications/actions';

/**
 * The landing step of every deep link (`/n/<id>` from the bell, the list,
 * an email or an SMS): marks the notification read through a POST — never as
 * a side effect of a GET — then replaces this page with the record, so Back
 * returns to where the person came from, not to this redirect.
 */
export function NotificationOpener({ id, fallbackHref }: { id: string; fallbackHref: string }) {
  const t = useTranslations('notifications');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Strict Mode runs effects twice in development; open exactly once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void openNotification(id).then((result) => {
      if (result.ok) router.replace(result.data.href);
      else setError(result.message);
    });
  }, [id, router]);

  if (error) return <Alert tone="danger">{error}</Alert>;

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <BrickLoader label={t('opening')} size="lg" />
      <p aria-hidden className="font-medium">
        {t('opening')}
      </p>
      <Link href={fallbackHref} className="text-action text-sm underline">
        {t('openFallback')}
      </Link>
    </div>
  );
}
