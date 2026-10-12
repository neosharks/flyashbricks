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

/** A forklift lifting a pallet of bricks into the stock yard. */
export function Forklift({ className, empty = false }: IllustrationProps & { empty?: boolean }) {
  return (
    <Svg viewBox="0 0 140 100" className={className}>
      <Ground x1={4} x2={136} y={94} />
      {/* Mast and forks */}
      <rect x={62} y={18} width={5} height={70} rx={1.5} className="fill-foreground-subtle" />
      <rect x={14} y={70} width={52} height={4} rx={1} className="fill-foreground-subtle" />
      {/* Pallet on the forks */}
      <rect x={14} y={64} width={46} height={5} rx={1.5} className="fill-brick-shade opacity-60" />
      {!empty && <BrickCourses x={15} y={64} rows={4} perRow={3} width={13} height={6} />}
      {/* Body, counterweight, overhead guard */}
      <path d="M68 86 V54 Q68 50 72 50 H112 Q118 50 118 56 V86 Z" className={ACCENT} />
      <path
        d="M74 50 V24 H104 L110 50"
        strokeWidth={STROKE + 0.5}
        strokeLinejoin="round"
        className="stroke-foreground-subtle"
      />
      <rect x={108} y={60} width={14} height={22} rx={3} className={BODY} strokeWidth={STROKE} />
      <Wheel cx={82} cy={86} r={8} />
      <Wheel cx={110} cy={86} r={8} />
    </Svg>
  );
}
