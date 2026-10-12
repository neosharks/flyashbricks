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

/**
 * The whole yard in one wide picture: silo, press, a pallet of finished
 * bricks and a loaded truck leaving. For the sign-in page and big empty spaces.
 */
export function FactoryScene({ className }: IllustrationProps) {
  return (
    <Svg viewBox="0 0 320 130" className={className}>
      <Ground x1={4} x2={316} y={122} />
      {/* Shed in the background */}
      <path d="M96 122 V58 L150 36 L204 58 V122" className="fill-surface-muted opacity-70" />
      <path
        d="M96 58 L150 36 L204 58"
        strokeWidth={STROKE}
        strokeLinejoin="round"
        className="stroke-border-strong"
      />
      {/* Silo */}
      <path
        d="M24 46 Q44 32 64 46 V100 L54 112 H34 L24 100 Z"
        className={BODY}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <rect x={25.5} y={66} width={37} height={34} className="fill-mortar" />
      <path
        d="M36 112 L32 122 M52 112 L56 122"
        strokeWidth={2.5}
        strokeLinecap="round"
        className="stroke-foreground-subtle"
      />
      {/* Pipe from silo to press */}
      <path
        d="M64 56 H110 V74"
        strokeWidth={4}
        strokeLinejoin="round"
        className="stroke-foreground-subtle opacity-60"
      />
      {/* Press */}
      <rect x={100} y={74} width={40} height={42} rx={3} className={BODY} strokeWidth={STROKE} />
      <rect x={114} y={78} width={12} height={16} rx={2} className={ACCENT} />
      <rect x={108} y={100} width={24} height={9} rx={1.5} className="fill-brick" />
      {/* Belt to pallet */}
      <rect
        x={140}
        y={110}
        width={40}
        height={4}
        rx={2}
        className="fill-foreground-subtle opacity-50"
      />
      <rect x={146} y={103} width={11} height={6} rx={1.5} className="fill-brick" />
      <rect x={162} y={103} width={11} height={6} rx={1.5} className="fill-brick" />
      {/* Pallet of finished bricks */}
      <rect
        x={184}
        y={116}
        width={46}
        height={5}
        rx={1.5}
        className="fill-brick-shade opacity-60"
      />
      <BrickCourses x={185} y={116} rows={5} perRow={3} width={13} height={6} />
      {/* Truck leaving */}
      <rect x={238} y={92} width={50} height={18} rx={3} className={BODY} strokeWidth={STROKE} />
      <BrickCourses x={241} y={92} rows={2} perRow={3} width={13} height={6} />
      <path d="M290 110 V84 Q290 80 294 80 H304 Q307 80 309 83 L314 96 V110 Z" className={ACCENT} />
      <rect
        x={236}
        y={108}
        width={80}
        height={5}
        rx={2}
        className="fill-foreground-subtle opacity-60"
      />
      <Wheel cx={252} cy={116} r={6} />
      <Wheel cx={276} cy={116} r={6} />
      <Wheel cx={304} cy={116} r={6} />
    </Svg>
  );
}
