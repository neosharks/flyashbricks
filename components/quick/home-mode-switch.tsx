'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setHomeMode } from '@/features/quick/actions';
import type { HomeMode } from '@/features/quick/tasks';

/** Moves between simple mode and the full app, and remembers it on this device. */
export function HomeModeSwitch({
  to,
  label,
  variant = 'outline',
  className,
}: {
  to: HomeMode;
  label: string;
  variant?: 'outline' | 'ghost';
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const Icon = to === 'simple' ? Smartphone : LayoutDashboard;

  return (
    <Button
      type="button"
      variant={variant}
      loading={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          await setHomeMode(to);
          router.push(to === 'simple' ? '/quick' : '/');
          router.refresh();
        })
      }
    >
      {!pending && <Icon aria-hidden />}
      {label}
    </Button>
  );
}
