import type { Gender } from '@/models/constants';
import { AVATAR_VARIANTS } from '@/models/constants';
import { cn } from '@/lib/utils';

/**
 * The default picture for anyone without a photo: a friendly construction
 * worker in a hard hat and safety vest, drawn inline — nothing to store,
 * download or license, and it works offline.
 *
 * Each of the 100 variants is a distinct combination of skin tone, hat, vest,
 * hairstyle and one extra (beard, moustache, glasses, earrings…), so a team
 * list looks like a team. New people are given variants in rotation.
 */
const SKIN = ['#f2cba8', '#e2ad86', '#c98f69', '#ad7550', '#8c5c3e', '#6e4630'];
const HATS = [
  { hat: '#f5b301', bg: '#fdf3d7' },
  { hat: '#f7f7f4', bg: '#e9eef3' },
  { hat: '#f28c28', bg: '#fde9d6' },
  { hat: '#2f7fd8', bg: '#e3eefb' },
  { hat: '#25a77f', bg: '#e1f4ee' },
  { hat: '#d94f45', bg: '#fbe6e3' },
  { hat: '#7b8794', bg: '#eceff2' },
  { hat: '#3a4fa3', bg: '#e6e9f7' },
];
const VESTS = ['#ff8a1f', '#c7e81f', '#ffd21f'];
const HAIR_COLOURS = ['#231a15', '#3b2a20', '#5a3d2b', '#8a8a8a'];

type Look = {
  skin: string;
  hat: string;
  bg: string;
  vest: string;
  hair: string;
  /** 0–2, meaning depends on gender. */
  style: number;
  /** 0–2: none, first extra, second extra. */
  extra: number;
};

/** Mixed-radix decode: every variant 0–99 is a different combination. */
export function lookFor(variant: number): Look {
  const v = ((Math.trunc(variant) % AVATAR_VARIANTS) + AVATAR_VARIANTS) % AVATAR_VARIANTS;
  const skin = v % SKIN.length;
  const rest = Math.floor(v / SKIN.length);
  const hat = rest % HATS.length;
  const extra = Math.floor(rest / HATS.length) % 3;
  return {
    skin: SKIN[skin] ?? '#c98f69',
    hat: HATS[hat]?.hat ?? '#f5b301',
    bg: HATS[hat]?.bg ?? '#fdf3d7',
    vest: VESTS[(v * 7) % VESTS.length] ?? '#ff8a1f',
    hair: HAIR_COLOURS[(v * 5) % HAIR_COLOURS.length] ?? '#231a15',
    style: (v * 11) % 3,
    extra,
  };
}

function Hair({ gender, look }: { gender: Gender; look: Look }) {
  if (gender === 'female') {
    return look.style === 2 ? (
      // A bun at the back of the head.
      <circle cx="45" cy="34" r="5" fill={look.hair} />
    ) : (
      // Long or shoulder-length hair behind the head.
      <path
        d={
          look.style === 0
            ? 'M17 30c0 14 2 22 6 26h18c4-4 6-12 6-26z'
            : 'M18 30c0 9 1 14 4 17h20c3-3 4-8 4-17z'
        }
        fill={look.hair}
      />
    );
  }
  return null;
}

function Temples({ gender, look }: { gender: Gender; look: Look }) {
  if (gender === 'male') {
    return look.style === 1 ? null : (
      <path d="M19.5 28c1-4 3-6 5-7l-2 8z M44.5 28c-1-4-3-6-5-7l2 8z" fill={look.hair} />
    );
  }
  if (gender === 'female') {
    return <path d="M19 30c1-6 5-9 9-10l-6 12z M45 30c-1-6-5-9-9-10l6 12z" fill={look.hair} />;
  }
  return null;
}

function Extras({ gender, look }: { gender: Gender; look: Look }) {
  const glasses = (
    <g stroke="#2b2b2b" strokeWidth="1.3" fill="#ffffff55">
      <circle cx="27.5" cy="32" r="3.4" />
      <circle cx="36.5" cy="32" r="3.4" />
      <path d="M30.9 32h2.2" />
    </g>
  );
  if (gender === 'male') {
    if (look.extra === 1) {
      return (
        <path
          d="M27.5 35.6c2-1.3 3.4-.6 4.5.2 1.1-.8 2.5-1.5 4.5-.2"
          stroke={look.hair}
          strokeWidth="1.9"
          fill="none"
          strokeLinecap="round"
        />
      );
    }
    if (look.extra === 2) {
      return (
        <path
          d="M21 34c1 9 6 12 11 12s10-3 11-12c-2 4-6 5-11 5s-9-1-11-5z"
          fill={look.hair}
          opacity=".9"
        />
      );
    }
    return look.style === 2 ? glasses : null;
  }
  if (gender === 'female') {
    if (look.extra === 1) {
      return (
        <>
          <circle cx="19.5" cy="36.5" r="1.3" fill="#f2c94c" />
          <circle cx="44.5" cy="36.5" r="1.3" fill="#f2c94c" />
        </>
      );
    }
    if (look.extra === 2) return glasses;
    return <circle cx="32" cy="27.5" r="0.9" fill="#c0392b" />;
  }
  // Neutral: safety goggles pushed up on the hat, or glasses.
  if (look.extra === 1) return glasses;
  if (look.extra === 2) {
    return (
      <rect
        x="23"
        y="21.5"
        width="18"
        height="4"
        rx="2"
        fill="#7fd1e8"
        stroke="#2b2b2b"
        strokeWidth=".8"
      />
    );
  }
  return null;
}

export function WorkerAvatar({
  gender,
  variant,
  className,
}: {
  gender: Gender;
  variant: number;
  className?: string;
}) {
  const look = lookFor(variant);
  return (
    <svg aria-hidden viewBox="0 0 64 64" className={cn('shrink-0 rounded-full', className)}>
      <circle cx="32" cy="32" r="32" fill={look.bg} />
      <Hair gender={gender} look={look} />

      {/* Shoulders in a hi-vis vest with a reflective stripe. */}
      <path d="M10 64c1-11 9-17 22-17s21 6 22 17z" fill="#3d4a5c" />
      <path d="M19 64c1-9 5-14 13-14s12 5 13 14z" fill={look.vest} />
      <path d="M20 58h24" stroke="#f4f6f8" strokeWidth="2.5" />
      <path d="M32 50v14" stroke="#3d4a5c" strokeWidth="1.5" />

      <rect x="28" y="40" width="8" height="9" rx="3" fill={look.skin} />
      <circle cx="32" cy="32" r="13" fill={look.skin} />
      <circle cx="19.5" cy="33" r="2.5" fill={look.skin} />
      <circle cx="44.5" cy="33" r="2.5" fill={look.skin} />
      <Temples gender={gender} look={look} />

      <circle cx="27.5" cy="32" r="1.4" fill="#2b2b2b" />
      <circle cx="36.5" cy="32" r="1.4" fill="#2b2b2b" />
      <path
        d="M28 37.5c2.4 2.2 5.6 2.2 8 0"
        stroke="#7a3b2e"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <Extras gender={gender} look={look} />

      {/* Hard hat: dome, ridge and brim. */}
      <path d="M17 26c0-9 7-15 15-15s15 6 15 15z" fill={look.hat} />
      <path d="M32 11v15" stroke="#00000022" strokeWidth="3" />
      <rect x="14" y="24.5" width="36" height="4" rx="2" fill={look.hat} />
      <rect x="14" y="27" width="36" height="1.5" rx=".75" fill="#00000026" />
    </svg>
  );
}

/** A stable picture for someone whose variant was never chosen (older records). */
export function defaultAvatarVariant(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % AVATAR_VARIANTS;
}
