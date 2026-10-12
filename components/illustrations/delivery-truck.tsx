import {
  ACCENT,
  BODY,
  BrickCourses,
  Ground,
  STROKE,
  Svg,
  Wheel,
  type IllustrationProps,
} from './shared';

/** A truck loaded with bricks — a sale on its way to the customer. */
export function DeliveryTruck({
  className,
  loaded = true,
}: IllustrationProps & { loaded?: boolean }) {
  return (
    <Svg viewBox="0 0 150 90" className={className}>
      <Ground x1={4} x2={146} y={82} />
      {/* Load bed */}
      <rect x={10} y={48} width={86} height={20} rx={3} className={BODY} strokeWidth={STROKE} />
      {loaded && <BrickCourses x={14} y={48} rows={3} perRow={5} width={14.5} height={6.5} />}
      {/* Cab */}
      <path d="M98 68 V36 Q98 32 102 32 H122 Q126 32 128 36 L138 54 V68 Z" className={ACCENT} />
      <path d="M104 37 H120 L127 52 H104 Z" className="fill-surface opacity-80" />
      <rect
        x={96}
        y={66}
        width={46}
        height={6}
        rx={2}
        className="fill-foreground-subtle opacity-60"
      />
      <rect
        x={8}
        y={66}
        width={90}
        height={6}
        rx={2}
        className="fill-foreground-subtle opacity-60"
      />
      <Wheel cx={30} cy={74} r={8} />
      <Wheel cx={58} cy={74} r={8} />
      <Wheel cx={120} cy={74} r={8} />
    </Svg>
  );
}
