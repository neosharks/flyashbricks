import Link from 'next/link';

export function BrandMark({ name, tagline }: { name: string; tagline?: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- a 2KB static SVG; next/image adds nothing here */}
      <img src="/icon.svg" alt="" width={32} height={32} className="size-8 rounded-lg" />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">{name}</span>
        {tagline && <span className="text-foreground-muted text-xs">{tagline}</span>}
      </span>
    </Link>
  );
}
