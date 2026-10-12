import 'server-only';
import sharp, { type Metadata } from 'sharp';
import type { ImageVariant } from '@/models/asset';

/** Longest side, in pixels, of each stored version. */
export const VARIANT_SIZES: Record<ImageVariant, number> = {
  /** Lists, tables, the header: drawn at 32–48 CSS px, so 96 covers 2× screens. */
  thumb: 96,
  /** Profile pages. */
  medium: 400,
  /** The largest kept; nobody needs more for a person's photo. */
  large: 1600,
};

/** What sharp may decode. Anything else — SVG above all, which can carry script — is refused. */
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif', 'gif', 'tiff']);

/** Refuse images that would take a lot of memory to decode (decompression bombs). */
const MAX_INPUT_PIXELS = 40_000_000;

export class UnsupportedImageError extends Error {}

export type ProcessedImage = {
  variants: Record<ImageVariant, { buffer: Buffer; width: number; height: number }>;
  contentType: 'image/webp';
};

/**
 * Turns an uploaded image into the stored versions.
 *
 * The real format is read from the bytes, never from the file name or the
 * declared type. Every version is re-encoded from pixels as WebP, which
 * also drops all metadata — including the GPS location phones write into
 * photos — and anything hidden after the image data. EXIF orientation is
 * applied first so the photo is not stored sideways.
 */
export async function processImage(
  input: Buffer,
  options: { square: boolean },
): Promise<ProcessedImage> {
  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new UnsupportedImageError('not an image');
  }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
    throw new UnsupportedImageError(`unsupported format ${metadata.format ?? 'unknown'}`);
  }

  const entries = await Promise.all(
    (Object.keys(VARIANT_SIZES) as ImageVariant[]).map(async (variant) => {
      const size = VARIANT_SIZES[variant];
      const { data, info } = await sharp(input, {
        limitInputPixels: MAX_INPUT_PIXELS,
        animated: false,
      })
        .rotate()
        .resize({
          width: size,
          height: size,
          // Avatars are cropped to a square around the centre; other images keep their shape.
          fit: options.square ? 'cover' : 'inside',
          position: 'attention',
          withoutEnlargement: true,
        })
        .webp({ quality: variant === 'thumb' ? 70 : 80, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      return [variant, { buffer: data, width: info.width, height: info.height }] as const;
    }),
  );

  return {
    variants: Object.fromEntries(entries) as ProcessedImage['variants'],
    contentType: 'image/webp',
  };
}
