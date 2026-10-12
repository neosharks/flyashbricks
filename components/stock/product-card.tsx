import { getLocale, getTranslations } from 'next-intl/server';
import { Factory } from 'lucide-react';
import { BrickStack } from '@/components/charts/brick-stack';
import { LevelBadge } from '@/components/raw-materials/level-badge';
import type { MaterialOption } from '@/features/raw-materials/types';
import type { ProductRow } from '@/features/stock/types';
import { formatMoney } from '@/lib/money';
import { formatQuantity } from '@/lib/quantity';
import { cn, formatNumber } from '@/lib/utils';
import { ProductDialog } from './product-dialog';
import { StockCorrectionDialog } from './stock-correction-dialog';

/** One brick type: bricks ready to sell (big), its status, and what the yard can still make. */
export async function ProductCard({
  product,
  canWrite,
  materials,
}: {
  product: ProductRow;
  canWrite: boolean;
  materials: MaterialOption[];
}) {
  const [t, tc, locale] = await Promise.all([
    getTranslations('production.stock'),
    getTranslations('common'),
    getLocale(),
  ]);
  // The pallet looks full at three times the alert level, or at 10,000 bricks when there is none.
  const full = product.lowStockThreshold > 0 ? product.lowStockThreshold * 3 : 10_000;

  return (
    <article
      className={cn(
        'border-border bg-surface flex flex-col gap-4 rounded-lg border p-4 shadow-xs',
        !product.isActive && 'opacity-60',
      )}
    >
      <div className="flex gap-4">
        <BrickStack ratio={product.stockGood / full} level={product.level} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{product.name}</h2>
              <p className="text-foreground-muted text-xs">
                {[product.size, product.isActive ? null : t('inactive')]
                  .filter(Boolean)
                  .join(' · ') || ' '}
              </p>
            </div>
            {canWrite && <ProductDialog product={product} materials={materials} />}
          </div>
          <p className="text-foreground-muted mt-2 text-xs">{t('readyToSell')}</p>
          <p className="text-3xl font-semibold tracking-tight">
            {formatNumber(product.stockGood, locale)}
          </p>
          <div className="mt-1">
            <LevelBadge level={product.level} label={t(`levels.${product.level}`)} />
          </div>
        </div>
      </div>

      <div className="bg-surface-muted flex flex-col gap-1 rounded-md p-3 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <Factory aria-hidden className="text-foreground-muted size-4 shrink-0" />
          {product.canMake === null
            ? t('canMakeNone')
            : t('canMake', { count: formatNumber(product.canMake, locale) })}
        </p>
        {product.limitingMaterial && product.canMake !== null && (
          <p className="text-foreground-muted text-xs">
            {t('limitedBy', { name: product.limitingMaterial })}
          </p>
        )}
      </div>

      {product.recipe.length > 0 && (
        <div className="text-sm">
          <p className="text-foreground-muted mb-1 text-xs">
            {t('mix', { count: product.recipeBatchSize })}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {product.recipe.map((line) => (
              <li
                key={line.materialId}
                className="border-border rounded-full border px-2.5 py-0.5 text-xs"
              >
                {line.materialName}: {formatQuantity(line.qtyMilli, locale)}{' '}
                {tc(`units.${line.unit}`)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-foreground-muted flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {product.defaultRatePaise > 0 && (
          <span>{t('rate', { rate: formatMoney(product.defaultRatePaise, locale) })}</span>
        )}
        {product.lowStockThreshold > 0 && (
          <span>{t('lowAt', { count: formatNumber(product.lowStockThreshold, locale) })}</span>
        )}
      </div>

      {canWrite && product.isActive && (
        <StockCorrectionDialog product={product} className="mt-auto w-full" />
      )}
    </article>
  );
}
