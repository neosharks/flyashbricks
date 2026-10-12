import { BrickCourses, Ground, Svg, type IllustrationProps } from './shared';

/** Fresh bricks curing in rows while water is sprayed over them. */
export function CuringYard({ className }: IllustrationProps) {
  return (
    <Svg viewBox="0 0 160 80" className={className}>
      <Ground x1={4} x2={156} y={74} />
      <BrickCourses x={10} y={74} rows={3} perRow={4} width={12} height={6} />
      <BrickCourses x={84} y={74} rows={3} perRow={4} width={12} height={6} />
      {/* Sprinkler and water arcs */}
      <rect x={76} y={30} width={4} height={44} rx={1} className="fill-foreground-subtle" />
      <circle cx={78} cy={28} r={4} className="fill-action" />
      <path
        d="M78 28 Q52 10 30 40 M78 28 Q104 10 126 40 M78 28 Q60 18 48 44 M78 28 Q96 18 108 44"
        strokeWidth={1.5}
        strokeDasharray="2 4"
        strokeLinecap="round"
        className="stroke-action opacity-70"
      />
    </Svg>
  );
}
