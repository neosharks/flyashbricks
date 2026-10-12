import { Wheel } from '@/components/illustrations/shared';
import { cn } from '@/lib/utils';

const SIZES = { sm: 'h-6', md: 'h-10', lg: 'h-16' } as const;

/** Bricks laid in stretcher bond, bottom course first: [x, y] of each. */
const LAYOUT: [number, number][] = [
  [0, 20],
  [16, 20],
  [8, 12],
  [24, 12],
  [16, 4],
];

/**
 * The app's loader: five bricks laid one after another, then the stack fades
 * and starts again. Announces `label` to screen readers; the drawing is
 * decorative.
 */
export function BrickLoader({
  label,
  size = 'md',
  className,
  showLabel = false,
  announce = true,
}: {
  label: string;
  size?: keyof typeof SIZES;
  className?: string;
  /** Print the label under the bricks as well as announcing it. */
  showLabel?: boolean;
  /** False inside a region that already announces loading, so it is not said twice. */
  announce?: boolean;
}) {
  return (
    <div
      {...(announce ? { role: 'status' } : { 'aria-hidden': true })}
      className={cn('inline-flex flex-col items-center gap-2', className)}
    >
      <svg aria-hidden viewBox="0 0 40 27" className={cn('brick-loader w-auto', SIZES[size])}>
        {LAYOUT.map(([x, y], index) => (
          <rect
            key={index}
            x={x}
            y={y}
            width={15}
            height={6.5}
            rx={1.5}
            className={cn('brick', index === 4 ? 'fill-action' : 'fill-brick')}
            style={{ animationDelay: `${index * 0.18}s` }}
          />
        ))}
      </svg>
      {showLabel ? (
        <span className="text-foreground-muted text-sm">{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
}

/** For longer waits (exports, backups): a loaded truck on a moving road. */
export function TruckLoader({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" className={cn('inline-flex flex-col items-center gap-2', className)}>
      <svg aria-hidden viewBox="0 0 120 56" className="truck-loader h-14 w-auto">
        <g className="truck">
          <rect
            x={10}
            y={14}
            width={62}
            height={20}
            rx={3}
            className="fill-surface-muted stroke-border-strong"
            strokeWidth={1.5}
          />
          {[14, 30, 46, 22, 38].map((x, index) => (
            <rect
              key={index}
              x={x}
              y={index < 3 ? 26 : 19}
              width={14}
              height={6}
              rx={1.5}
              className={index % 2 === 0 ? 'fill-brick' : 'fill-brick-shade'}
            />
          ))}
          <path
            d="M74 34 V16 Q74 12 78 12 H90 Q93 12 95 15 L104 28 V34 Z"
            className="fill-action"
          />
          <rect
            x={8}
            y={33}
            width={98}
            height={4}
            rx={2}
            className="fill-foreground-subtle opacity-60"
          />
          <Wheel cx={26} cy={40} r={6} />
          <Wheel cx={56} cy={40} r={6} />
          <Wheel cx={92} cy={40} r={6} />
        </g>
        <line
          x1={0}
          x2={120}
          y1={51}
          y2={51}
          strokeWidth={2}
          strokeDasharray="12 12"
          strokeLinecap="round"
          className="road stroke-border-strong"
        />
      </svg>
      <span className="text-foreground-muted text-sm">{label}</span>
    </div>
  );
}
