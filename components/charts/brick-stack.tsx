import { cn } from '@/lib/utils';
import type { Level } from '@/components/ui/meter';

const ROWS = 8;

/**
 * A pallet of bricks that fills up with stock: the house illustration for
 * finished bricks. Decorative — the number and level beside it carry the
 * meaning, so it is hidden from assistive tech.
 */
export function BrickStack({
  ratio,
  level,
  className,
}: {
  /** 0–1: how full the pallet looks. */
  ratio: number;
  level: Level;
  className?: string;
}) {
  const filledRows = Math.round(Math.min(1, Math.max(0, ratio)) * ROWS);
  const brickW = 22;
  const brickH = 9;
  const gap = 2;
  const perRow = 3;
  const width = perRow * brickW + (perRow - 1) * gap + brickW / 2 + 4;
  const height = ROWS * (brickH + gap) + 8;

  const tone =
    level === 'critical'
      ? 'fill-status-critical/80'
      : level === 'warning'
        ? 'fill-status-warning/80'
        : 'fill-brick';

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      className={cn('h-20 w-auto shrink-0', className)}
    >
      {/* Pallet */}
      <rect x={0} y={height - 5} width={width} height={5} rx={1} className="fill-brick-shade/60" />
      {Array.from({ length: ROWS }, (_, row) => {
        const filled = row < filledRows;
        const y = height - 6 - (row + 1) * (brickH + gap) + gap;
        const offset = row % 2 === 0 ? 2 : 2 + brickW / 2;
        return Array.from({ length: perRow }, (_, column) => (
          <rect
            key={`${row}-${column}`}
            x={offset + column * (brickW + gap)}
            y={y}
            width={brickW}
            height={brickH}
            rx={1.5}
            className={filled ? tone : 'fill-mortar'}
          />
        ));
      })}
    </svg>
  );
}
