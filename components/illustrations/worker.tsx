import { ACCENT, Ground, Svg, type IllustrationProps } from './shared';

/** A plant worker in a hard hat and safety vest. */
export function Worker({ className }: IllustrationProps) {
  return (
    <Svg viewBox="0 0 80 110" className={className}>
      <Ground x1={10} x2={70} y={104} />
      {/* Legs */}
      <rect x={28} y={72} width={9} height={30} rx={3} className="fill-foreground-subtle" />
      <rect x={43} y={72} width={9} height={30} rx={3} className="fill-foreground-subtle" />
      {/* Body with safety vest */}
      <rect
        x={22}
        y={40}
        width={36}
        height={36}
        rx={8}
        className="fill-surface-muted stroke-border-strong"
        strokeWidth={1.5}
      />
      <path d="M30 41 V76 M50 41 V76" strokeWidth={6} className="stroke-warning opacity-80" />
      <path d="M24 60 H56" strokeWidth={3} className="stroke-surface" />
      {/* Arms */}
      <rect
        x={14}
        y={44}
        width={8}
        height={26}
        rx={4}
        className="fill-surface-muted stroke-border-strong"
        strokeWidth={1.5}
      />
      <rect
        x={58}
        y={44}
        width={8}
        height={26}
        rx={4}
        className="fill-surface-muted stroke-border-strong"
        strokeWidth={1.5}
      />
      {/* Head and hard hat */}
      <circle cx={40} cy={28} r={11} className="fill-brick opacity-70" />
      <path d="M27 24 Q28 10 40 10 Q52 10 53 24 Z" className={ACCENT} />
      <rect x={25} y={22} width={30} height={4} rx={2} className={ACCENT} />
    </Svg>
  );
}
