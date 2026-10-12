import { Ground, Svg, type IllustrationProps } from './shared';

/** A belt conveyor carrying fresh bricks to the curing yard. */
export function Conveyor({ className }: IllustrationProps) {
  return (
    <Svg viewBox="0 0 160 70" className={className}>
      <Ground x1={4} x2={156} y={64} />
      {/* Belt with rollers */}
      <rect
        x={10}
        y={34}
        width={140}
        height={10}
        rx={5}
        className="fill-foreground-subtle opacity-50"
      />
      {[18, 46, 74, 102, 130, 142].map((cx) => (
        <circle key={cx} cx={cx} cy={39} r={3} className="fill-surface" />
      ))}
      {/* Legs */}
      {[24, 80, 136].map((x) => (
        <rect
          key={x}
          x={x}
          y={44}
          width={4}
          height={20}
          rx={1}
          className="fill-foreground-subtle opacity-60"
        />
      ))}
      {/* Bricks on the belt */}
      {[20, 52, 84, 116].map((x) => (
        <rect key={x} x={x} y={24} width={22} height={9} rx={1.5} className="fill-brick" />
      ))}
    </Svg>
  );
}
