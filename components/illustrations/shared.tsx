import { cn } from '@/lib/utils';

/**
 * Shared pieces for the factory illustrations. Everything is drawn with the
 * theme's colour tokens, so the art follows light and dark mode, and every
 * illustration is decorative: the text beside it carries the meaning.
 *
 * House style: 1.5 outline strokes, bricks with 1.5 corner radius, machine
 * bodies with 3, wheels in the subtle ink with a surface-coloured hub.
 */
export type IllustrationProps = { className?: string };

export function Svg({
  viewBox,
  className,
  children,
}: {
  viewBox: string;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-auto w-full', className)}
    >
      {children}
    </svg>
  );
}

/** Body of a machine or vehicle: muted surface with a strong outline. */
export const BODY = 'fill-surface-muted stroke-border-strong';
export const ACCENT = 'fill-action';
export const STROKE = 1.5;

/**
 * Bricks laid in stretcher bond: every other course offset by half a brick.
 * `rows` courses of `perRow` bricks starting at (x, y), bottom course first
 * when drawn upward with a negative `step`.
 */
export function BrickCourses({
  x,
  y,
  rows,
  perRow,
  width = 14,
  height = 6,
  gap = 1.5,
}: {
  x: number;
  y: number;
  rows: number;
  perRow: number;
  width?: number;
  height?: number;
  gap?: number;
}) {
  const bricks: React.ReactNode[] = [];
  for (let row = 0; row < rows; row += 1) {
    const offset = row % 2 === 0 ? 0 : width / 2;
    const count = row % 2 === 0 ? perRow : perRow - 1;
    for (let column = 0; column < count; column += 1) {
      bricks.push(
        <rect
          key={`${row}-${column}`}
          x={x + offset + column * (width + gap)}
          y={y - (row + 1) * (height + gap)}
          width={width}
          height={height}
          rx={1.5}
          className={row % 3 === 2 ? 'fill-brick-shade' : 'fill-brick'}
        />,
      );
    }
  }
  return <g>{bricks}</g>;
}

export function Wheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className="fill-foreground-subtle" />
      <circle cx={cx} cy={cy} r={r * 0.42} className="fill-surface" />
    </g>
  );
}

export function Ground({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <line
      x1={x1}
      x2={x2}
      y1={y}
      y2={y}
      strokeWidth={STROKE}
      strokeLinecap="round"
      className="stroke-border-strong"
    />
  );
}
