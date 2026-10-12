import { ACCENT, BODY, Ground, STROKE, Svg, type IllustrationProps } from './shared';

/** A storage silo for fly ash or cement, about two-thirds full. */
export function Silo({ className }: IllustrationProps) {
  return (
    <Svg viewBox="0 0 80 110" className={className}>
      <Ground x1={6} x2={74} y={104} />
      <path
        d="M16 22 Q40 4 64 22 V76 L50 90 H30 L16 76 Z"
        className={BODY}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* Contents */}
      <rect x={17.5} y={42} width={45} height={34} className="fill-mortar" />
      <path d="M17.5 76 L30 88.5 H50 L62.5 76 Z" className="fill-mortar" />
      {/* Level marks */}
      {[34, 50, 66].map((y) => (
        <line
          key={y}
          x1={58}
          x2={63}
          y1={y}
          y2={y}
          strokeWidth={1}
          className="stroke-border-strong"
        />
      ))}
      {/* Ladder and legs */}
      <path d="M68 24 V96 M73 24 V96" strokeWidth={1} className="stroke-foreground-subtle" />
      {[32, 44, 56, 68, 80, 92].map((y) => (
        <line
          key={y}
          x1={68}
          x2={73}
          y1={y}
          y2={y}
          strokeWidth={1}
          className="stroke-foreground-subtle"
        />
      ))}
      <path
        d="M30 90 L26 104 M50 90 L54 104"
        strokeWidth={2.5}
        strokeLinecap="round"
        className="stroke-foreground-subtle"
      />
      <rect x={34} y={10} width={12} height={6} rx={2} className={ACCENT} />
    </Svg>
  );
}
