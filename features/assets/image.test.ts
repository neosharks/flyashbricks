// @vitest-environment node
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { processImage, UnsupportedImageError } from './image';

async function photo(width: number, height: number, withGps = false): Promise<Buffer> {
  const image = sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 80, b: 40 } },
  }).jpeg();
  return withGps
    ? image.withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '26/1 54/1 0/1' } }).toBuffer()
    : image.toBuffer();
}

describe('processImage', () => {
  it('makes three square WebP versions no larger than their targets', async () => {
    const result = await processImage(await photo(3000, 2000), { square: true });
    expect(result.variants.thumb).toMatchObject({ width: 96, height: 96 });
    expect(result.variants.medium).toMatchObject({ width: 400, height: 400 });
    expect(result.variants.large).toMatchObject({ width: 1600, height: 1600 });
    const format = await sharp(result.variants.medium.buffer).metadata();
    expect(format.format).toBe('webp');
  });

  it('never enlarges a small photo', async () => {
    const result = await processImage(await photo(200, 200), { square: true });
    expect(result.variants.large.width).toBe(200);
  });

  it('removes location and other metadata from the stored files', async () => {
    const result = await processImage(await photo(800, 800, true), { square: true });
    const meta = await sharp(result.variants.large.buffer).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it('compresses: the thumbnail is a tiny fraction of the upload', async () => {
    const input = await photo(3000, 3000);
    const result = await processImage(input, { square: true });
    expect(result.variants.thumb.buffer.length).toBeLessThan(5_000);
  });

  it('refuses things that are not images, and SVG', async () => {
    await expect(
      processImage(Buffer.from('not an image at all'), { square: true }),
    ).rejects.toBeInstanceOf(UnsupportedImageError);
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
    );
    await expect(processImage(svg, { square: true })).rejects.toBeInstanceOf(UnsupportedImageError);
  });
});
