'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A password field with a show/hide toggle — typing on a phone keyboard is error-prone. */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentPropsWithRef<'input'>, 'type'>) {
  const t = useTranslations('auth');
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className={cn(
          'border-border-strong bg-surface text-foreground aria-[invalid]:border-danger aria-[invalid]:ring-danger min-h-11 w-full rounded-md border py-2.5 pr-11 pl-3 text-base aria-[invalid]:ring-1',
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="text-foreground-muted hover:text-foreground absolute inset-y-0 right-0 flex w-11 items-center justify-center"
        aria-label={visible ? t('hidePassword') : t('showPassword')}
        aria-pressed={visible}
      >
        {visible ? (
          <EyeOff aria-hidden className="size-4" />
        ) : (
          <Eye aria-hidden className="size-4" />
        )}
      </button>
    </div>
  );
}
