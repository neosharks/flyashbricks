import 'server-only';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import type { StorageDriver } from './types';

const KEY_PATTERN = /^[a-z0-9][a-z0-9/_-]*(\.[a-z0-9]+)?$/;

/**
 * Files on this server's disk. Keys are checked against a strict pattern and
 * the resolved path must stay under the root, so a key can never reach
 * outside the storage directory.
 */
export function localDriver(rootDir: string): StorageDriver {
  const root = path.resolve(rootDir);

  function resolve(key: string): string {
    if (!KEY_PATTERN.test(key) || key.includes('..') || key.includes('//')) {
      throw new Error(`invalid storage key: ${key}`);
    }
    const full = path.resolve(root, key);
    if (!full.startsWith(`${root}${path.sep}`)) throw new Error(`storage key escapes root: ${key}`);
    return full;
  }

  return {
    async put(key, body) {
      const target = resolve(key);
      await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      // Write then rename: a reader never sees a half-written file.
      const temporary = `${target}.${randomUUID()}.tmp`;
      await writeFile(temporary, body, { mode: 0o600 });
      await rename(temporary, target);
    },

    async get(key) {
      const target = resolve(key);
      try {
        const info = await stat(target);
        if (!info.isFile()) return null;
        const stream = Readable.toWeb(createReadStream(target)) as ReadableStream<Uint8Array>;
        return { body: stream, bytes: info.size, contentType: 'application/octet-stream' };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
    },

    async deletePrefix(prefix) {
      const target = resolve(prefix.replace(/\/+$/, ''));
      await rm(target, { recursive: true, force: true });
    },
  };
}
