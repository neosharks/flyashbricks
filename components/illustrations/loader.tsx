import { ACCENT, BODY, Ground, STROKE, Svg, Wheel, type IllustrationProps } from './shared';

/** A wheel loader carrying a bucket of fly ash to the mixer. */
export function Loader({ className }: IllustrationProps) {
  return (
    <Svg viewBox="0 0 150 90" className={className}>
      <Ground x1={4} x2={146} y={84} />
      {/* Body and cab */}
      <rect x={40} y={46} width={66} height={22} rx={3} className={ACCENT} />
      <path
        d="M76 46 V22 Q76 18 80 18 H98 Q102 18 102 22 V46 Z"
        className={BODY}
        strokeWidth={STROKE}
      />
      <rect x={82} y={24} width={14} height={14} rx={2} className="fill-surface" />
      <rect x={106} y={40} width={10} height={6} rx={2} className="fill-foreground-subtle" />
      {/* Arm and bucket with ash */}
      <path
        d="M44 52 L22 40"
        strokeWidth={5}
        strokeLinecap="round"
        className="stroke-foreground-subtle"
      />
      <path
        d="M6 36 H28 L24 54 H10 Z"
        className={BODY}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <path d="M8 36 Q17 26 28 36 Z" className="fill-mortar stroke-border-strong" strokeWidth={1} />
      <Wheel cx={56} cy={72} r={11} />
      <Wheel cx={96} cy={72} r={11} />
    </Svg>
  );
}
