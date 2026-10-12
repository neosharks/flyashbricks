import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Forklift } from '@/components/illustrations';

export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <main
      id="main"
      className="mx-auto flex min-h-[60dvh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center"
    >
      {/* A forklift with an empty pallet: whatever was here has been moved. */}
      <Forklift empty className="w-44" />
      <p className="text-foreground-muted text-sm font-medium">404</p>
      <h1 className="text-2xl font-semibold">{t('notFoundTitle')}</h1>
      <p className="text-foreground-muted">{t('notFoundBody')}</p>
      <Button asChild>
        <Link href="/">{t('goHome')}</Link>
      </Button>
    </main>
  );
}
