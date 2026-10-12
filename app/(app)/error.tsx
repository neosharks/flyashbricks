'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  useEffect(() => {
    console.error('page error', error.digest);
  }, [error]);

  return (
    <div className="max-w-xl">
      <Alert tone="danger" title={t('errorTitle')}>
        <p>{t('errorBody')}</p>
        {error.digest && (
          <p className="mt-2 text-xs">{t('errorReference', { digest: error.digest })}</p>
        )}
      </Alert>
      <Button className="mt-4" onClick={reset}>
        {t('tryAgain')}
      </Button>
    </div>
  );
}
