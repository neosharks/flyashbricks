'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * How a charged rate compares with the brick type's usual price, in words:
 * "₹0.50 below usual price (₹6.50)". Says nothing when they match. The
 * arrow and the words carry the meaning; colour only supports them.
 */
export function RateComparison({
  ratePaise,
  defaultRatePaise,
  variant,
  className,
}: {
  ratePaise: number;
  defaultRatePaise: number;
  /** `form` while typing a sale, `detail` on a saved bill. */
  variant: 'form' | 'detail';
  className?: string;
}) {
  const t = useTranslations(variant === 'form' ? 'sales.form' : 'sales.detail');
  const locale = useLocale();
  const diff = ratePaise - defaultRatePaise;
  if (defaultRatePaise <= 0) return null;

  const money = (paise: number) => formatMoney(paise, locale);
  if (diff === 0) {
    return variant === 'form' ? (
      <p className={cn('text-foreground-muted text-xs', className)}>
        {t('usualPrice', { rate: money(defaultRatePaise) })}
      </p>
    ) : null;
  }

  const Icon = diff < 0 ? ArrowDown : ArrowUp;
  const values = { diff: money(Math.abs(diff)), rate: money(defaultRatePaise) };
  return (
    <p
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        diff < 0 ? 'text-danger' : 'text-success',
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {diff < 0 ? t('belowUsual', values) : t('aboveUsual', values)}
    </p>
  );
}
