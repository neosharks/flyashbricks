import { BrickCourses, Ground, Svg, type IllustrationProps } from './shared';

/** A pallet stacked with bricks — finished stock waiting to be sold. */
export function BrickPallet({ className, empty = false }: IllustrationProps & { empty?: boolean }) {
  return (
    <Svg viewBox="0 0 120 90" className={className}>
      <Ground x1={8} x2={112} y={84} />
      {/* Pallet: deck and three blocks */}
      <rect x={18} y={70} width={84} height={5} rx={1.5} className="fill-brick-shade opacity-60" />
      {[20, 56, 92].map((x) => (
        <rect
          key={x}
          x={x}
          y={75}
          width={8}
          height={8}
          rx={1}
          className="fill-brick-shade opacity-50"
        />
      ))}
      {!empty && <BrickCourses x={20} y={70} rows={6} perRow={5} width={14.5} height={6.5} />}
    </Svg>
  );
}
