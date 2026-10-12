import { ACCENT, BODY, Ground, STROKE, Svg, type IllustrationProps } from './shared';

/** The hydraulic press that turns the fly ash mix into bricks. */
export function BrickPress({ className }: IllustrationProps) {
  return (
    <Svg viewBox="0 0 140 100" className={className}>
      <Ground x1={6} x2={134} y={94} />
      {/* Hopper with mix */}
      <path
        d="M30 12 H62 L56 30 H36 Z"
        className={BODY}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <path d="M34 15 H58 L55 22 H37 Z" className="fill-mortar" />
      {/* Frame and hydraulic cylinder */}
      <rect x={22} y={30} width={50} height={56} rx={3} className={BODY} strokeWidth={STROKE} />
      <rect x={40} y={34} width={14} height={20} rx={2} className={ACCENT} />
      <rect x={45} y={54} width={4} height={10} className="fill-foreground-subtle" />
      {/* Mould with a brick being pressed */}
      <rect
        x={30}
        y={64}
        width={34}
        height={12}
        rx={1.5}
        className="fill-surface stroke-border-strong"
        strokeWidth={STROKE}
      />
      <rect x={36} y={67} width={22} height={7} rx={1.5} className="fill-brick" />
      <rect
        x={22}
        y={86}
        width={50}
        height={8}
        rx={2}
        className="fill-foreground-subtle opacity-40"
      />
      {/* Control box */}
      <rect x={8} y={50} width={12} height={18} rx={2} className={BODY} strokeWidth={STROKE} />
      <circle cx={14} cy={56} r={2} className={ACCENT} />
      <circle cx={14} cy={62} r={2} className="fill-warning" />
      {/* Belt carrying fresh bricks out */}
      <rect
        x={72}
        y={78}
        width={60}
        height={5}
        rx={2.5}
        className="fill-foreground-subtle opacity-50"
      />
      {[78, 96, 114].map((x) => (
        <rect key={x} x={x} y={70} width={14} height={7} rx={1.5} className="fill-brick" />
      ))}
    </Svg>
  );
}
