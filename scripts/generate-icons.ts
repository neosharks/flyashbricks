/**
 * Writes the PNG app icons the web manifest and iOS need, from the same brick
 * motif as public/icon.svg. Dependency-free (a tiny PNG encoder over zlib), so
 * nobody needs an image toolchain to change the icon.
 *
 * Usage: pnpm exec tsx scripts/generate-icons.ts
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BRICK: [number, number, number] = [0xa8, 0x43, 0x2a];
const FACE: [number, number, number] = [0xf3, 0xd9, 0xc9];

/** Bricks on the 64-unit grid of icon.svg: x, y, width, height. */
const BRICKS = [
  [10, 14, 20, 9],
  [33, 14, 21, 9],
  [10, 27, 9, 9],
  [22, 27, 20, 9],
  [45, 27, 9, 9],
  [10, 40, 20, 9],
  [33, 40, 21, 9],
] as const;

function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * `inset` shrinks the motif towards the centre: maskable icons are cropped to
 * a circle by Android, so their content must sit inside the middle 80%.
 */
function render(size: number, options: { rounded: boolean; inset: number }): Buffer {
  const rows: Buffer[] = [];
  const scale = (size * (1 - options.inset * 2)) / 64;
  const offset = size * options.inset;
  const radius = options.rounded ? size * 0.22 : 0;

  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x += 1) {
      // Rounded-corner mask for the plain icon; maskable icons are full-bleed.
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      const outside =
        radius > 0 && cx < radius && cy < radius && Math.hypot(radius - cx, radius - cy) > radius;

      const ux = (x - offset) / scale;
      const uy = (y - offset) / scale;
      const onBrick = BRICKS.some(
        ([bx, by, bw, bh]) => ux >= bx && ux < bx + bw && uy >= by && uy < by + bh,
      );
      const [r, g, b] = onBrick ? FACE : BRICK;
      row.set([r, g, b, outside ? 0 : 255], 1 + x * 4);
    }
    rows.push(row);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/icon-192.png', render(192, { rounded: true, inset: 0 }));
writeFileSync('public/icon-512.png', render(512, { rounded: true, inset: 0 }));
writeFileSync('public/icon-maskable-512.png', render(512, { rounded: false, inset: 0.1 }));
writeFileSync('public/apple-touch-icon.png', render(180, { rounded: false, inset: 0.06 }));
console.log('icons written to public/');
