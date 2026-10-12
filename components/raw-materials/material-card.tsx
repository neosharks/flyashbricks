import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronRight, Clock } from 'lucide-react';
import { SiloGauge } from '@/components/charts/silo-gauge';
import { Meter } from '@/components/ui/meter';
import type { MaterialRow } from '@/features/raw-materials/types';
import { formatQuantity } from '@/lib/quantity';
import { cn } from '@/lib/utils';
import { LevelBadge } from './level-badge';
import { AdjustDialog } from './adjust-dialog';
import { PurchaseDialog } from './purchase-dialog';

/** One material: the big number first, its status in words, then the two everyday actions. */
export async function MaterialCard({
  material,
  canWrite,
}: {
  material: MaterialRow;
  canWrite: boolean;
}) {
  const [t, tc, locale] = await Promise.all([
    getTranslations('rawMaterials'),
    getTranslations('common'),
    getLocale(),
  ]);
  const unit = tc(`units.${material.unit}`);
  const thresholdRatio =
    material.capacityMilli && material.capacityMilli > 0
      ? material.lowThresholdMilli / material.capacityMilli
      : material.lowThresholdMilli > 0
        ? 0.5
        : null;

  return (
    <article
      className={cn(
        'border-border bg-surface flex flex-col gap-4 rounded-lg border p-4 shadow-xs',
        !material.isActive && 'opacity-60',
      )}
    >
      <div className="flex gap-4">
        <SiloGauge ratio={material.fill} thresholdRatio={thresholdRatio} level={material.level} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 truncate font-semibold">
              <Link href={`/raw-materials/${material.id}`} className="hover:text-action">
                {material.name}
              </Link>
            </h2>
            <Link
              href={`/raw-materials/${material.id}`}
              className="text-foreground-muted hover:text-foreground -m-3 shrink-0 p-3"
              aria-label={`${t('details')}: ${material.name}`}
            >
              <ChevronRight aria-hidden className="size-5" />
            </Link>
          </div>
          <p className="text-foreground-muted text-xs">
            {t(`kinds.${material.kind}`)}
            {!material.isActive && ` · ${t('inactive')}`}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">
            {formatQuantity(material.quantityMilli, locale)}{' '}
            <span className="text-foreground-muted text-base font-normal">{unit}</span>
          </p>
          <div className="mt-1">
            <LevelBadge level={material.level} label={t(`levels.${material.level}`)} />
          </div>
        </div>
      </div>

      <Meter
        value={Math.round(material.fill * 100)}
        max={100}
        level={material.level}
        label={t('fill', { name: material.name })}
      />

      <div className="text-foreground-muted flex flex-col gap-1 text-sm">
        <p className="flex items-center gap-1.5">
          <Clock aria-hidden className="size-4 shrink-0" />
          {material.runwayDays === null ? (
            t('runway.none')
          ) : (
            <span>
              {t('runway.label')}{' '}
              <strong className="text-foreground">
                {t('runway.days', { count: material.runwayDays })}
              </strong>
            </span>
          )}
        </p>
        <p className="text-xs">
          {t('threshold', { qty: formatQuantity(material.lowThresholdMilli, locale), unit })}
        </p>
      </div>

      {canWrite && material.isActive && (
        <div className="mt-auto grid grid-cols-1 gap-2 sm:grid-cols-2">
          <PurchaseDialog material={material} className="w-full" />
          <AdjustDialog material={material} className="w-full" />
        </div>
      )}
    </article>
  );
}
