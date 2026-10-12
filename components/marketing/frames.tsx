import Image from 'next/image';
import { cn } from '@/lib/utils';

type Picture = { src: string; width: number; height: number; alt: string };

/** A screenshot inside a phone outline. */
export function PhoneFrame({
  image,
  sizes = '(min-width: 1024px) 18rem, 60vw',
  preload = false,
  className,
}: {
  image: Picture;
  sizes?: string;
  preload?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[2.25rem] bg-[oklch(20%_0.01_260)] p-2 shadow-2xl ring-1 shadow-black/25 ring-black/10',
        className,
      )}
    >
      <Image
        src={image.src}
        width={image.width}
        height={image.height}
        alt={image.alt}
        sizes={sizes}
        preload={preload}
        className="h-auto w-full rounded-[1.5rem]"
      />
    </div>
  );
}

/** A screenshot inside a plain browser window. */
export function BrowserFrame({
  image,
  sizes = '(min-width: 1280px) 56rem, 92vw',
  preload = false,
  className,
}: {
  image: Picture;
  sizes?: string;
  preload?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border bg-surface overflow-hidden rounded-xl border shadow-2xl shadow-black/15',
        className,
      )}
    >
      <div aria-hidden className="border-border flex items-center gap-1.5 border-b px-3 py-2">
        <span className="size-2.5 rounded-full bg-[oklch(70%_0.17_25)]" />
        <span className="size-2.5 rounded-full bg-[oklch(82%_0.15_85)]" />
        <span className="size-2.5 rounded-full bg-[oklch(72%_0.15_150)]" />
        <span className="bg-surface-muted mx-auto hidden h-4 w-1/2 rounded-md sm:block" />
      </div>
      <Image
        src={image.src}
        width={image.width}
        height={image.height}
        alt={image.alt}
        sizes={sizes}
        preload={preload}
        className="h-auto w-full"
      />
    </div>
  );
}
