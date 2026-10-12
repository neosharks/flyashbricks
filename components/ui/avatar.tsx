import { cn } from '@/lib/utils';
import type { Gender } from '@/models/constants';
import { defaultAvatarVariant, WorkerAvatar } from './worker-avatar';

const SIZES = {
  sm: { box: 'size-8 text-xs', variant: 'thumb', px: 32 },
  md: { box: 'size-10 text-sm', variant: 'thumb', px: 40 },
  lg: { box: 'size-16 text-lg', variant: 'medium', px: 64 },
  xl: { box: 'size-24 text-2xl', variant: 'medium', px: 96 },
} as const;

export function avatarUrl(imageId: string, size: keyof typeof SIZES = 'md'): string {
  return `/api/assets/${imageId}/${SIZES[size].variant}`;
}

/**
 * A person's photo, or their default cartoon worker when there is none.
 * Lists and tables ask for the 96px thumbnail (a few kilobytes); profile pages
 * for the 400px version. Width and height are always set, so nothing shifts
 * as photos load.
 */
export function Avatar({
  name,
  imageId,
  gender,
  variant,
  size = 'md',
  className,
}: {
  name: string;
  imageId: string | null | undefined;
  gender?: Gender | null | undefined;
  /** The chosen cartoon; derived from the name when not given. */
  variant?: number | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const spec = SIZES[size];
  if (imageId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served by our own authenticated route in pre-sized versions; next/image's optimiser cannot carry the session cookie
      <img
        src={avatarUrl(imageId, size)}
        alt=""
        width={spec.px}
        height={spec.px}
        loading="lazy"
        decoding="async"
        className={cn('bg-surface-muted shrink-0 rounded-full object-cover', spec.box, className)}
      />
    );
  }
  return (
    <WorkerAvatar
      gender={gender ?? 'unspecified'}
      variant={variant ?? defaultAvatarVariant(name)}
      className={cn(spec.box, className)}
    />
  );
}
