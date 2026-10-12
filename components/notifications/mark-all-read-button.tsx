'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { markAllRead } from '@/features/notifications/actions';

export function MarkAllReadButton() {
  const t = useTranslations('notifications');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await markAllRead();
          if (result.ok) {
            toast.success(t('markedAllRead'));
            router.refresh();
          } else {
            toast.error(result.message);
          }
        })
      }
    >
      {!pending && <CheckCheck aria-hidden />}
      {t('markAllRead')}
    </Button>
  );
}
