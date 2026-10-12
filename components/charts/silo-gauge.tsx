import { cn } from '@/lib/utils';
import type { Level } from '@/components/ui/meter';

const FILL: Record<Level, string> = {
  good: 'fill-status-good',
  warning: 'fill-status-warning',
  critical: 'fill-status-critical',
};

/**
 * A storage silo filled to the current level, with a tick at the low-stock
 * threshold. Decorative: the quantity and status text next to it say the same
 * thing in words.
 */
export function SiloGauge({
  ratio,
  thresholdRatio,
  level,
  className,
}: {
  ratio: number;
  /** Where the low-stock line sits, 0–1. */
  thresholdRatio: number | null;
  level: Level;
  className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, ratio));
  const bodyTop = 14;
  const bodyHeight = 60;
  const fillHeight = bodyHeight * clamped;
  const threshold =
    thresholdRatio === null ? null : bodyTop + bodyHeight * (1 - Math.min(1, thresholdRatio));

  return (
    <svg aria-hidden viewBox="0 0 48 96" className={cn('h-20 w-auto shrink-0', className)}>
      <path
        d="M8 14 Q24 2 40 14 V74 L30 86 H18 L8 74 Z"
        className="fill-surface-muted stroke-border-strong"
        strokeWidth={1.5}
      />
      {/* Fill only the straight body, so no clip path (and no page-unique id) is needed. */}
      <rect
        x={9.5}
        y={bodyTop + bodyHeight - fillHeight}
        width={29}
        height={fillHeight}
        rx={1}
        className={cn(FILL[level], 'opacity-85')}
      />
      {threshold !== null && (
        <line
          x1={4}
          x2={44}
          y1={threshold}
          y2={threshold}
          className="stroke-foreground-muted"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
      )}
      <path
        d="M14 86 L12 94 M34 86 L36 94"
        className="stroke-border-strong"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}
