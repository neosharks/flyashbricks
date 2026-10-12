// @vitest-environment node
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { localDriver } from './local';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'flyash-storage-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function text(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

describe('localDriver', () => {
  it('stores, reads back and deletes by prefix', async () => {
    const driver = localDriver(dir);
    await driver.put('org/a/avatars/1/thumb.webp', Buffer.from('thumb'), 'image/webp');
    await driver.put('org/a/avatars/1/medium.webp', Buffer.from('medium'), 'image/webp');

    const object = await driver.get('org/a/avatars/1/thumb.webp');
    if (!object) throw new Error('expected the stored file');
    expect(object.bytes).toBe(5);
    expect(await text(object.body)).toBe('thumb');

    await driver.deletePrefix('org/a/avatars/1/');
    expect(await driver.get('org/a/avatars/1/medium.webp')).toBeNull();
  });

  it('returns null for a missing file', async () => {
    expect(await localDriver(dir).get('org/a/nothing.webp')).toBeNull();
  });

  it('refuses keys that could escape the storage folder', async () => {
    const driver = localDriver(dir);
    for (const key of ['../secret', 'org/../../etc/passwd', '/etc/passwd', 'org//a', 'Org/A.webp']) {
      await expect(driver.put(key, Buffer.from('x'), 'text/plain')).rejects.toThrow(/storage key/);
    }
  });

  it('leaves no temporary files behind', async () => {
    const driver = localDriver(dir);
    await driver.put('org/a/file.webp', Buffer.from('x'), 'image/webp');
    expect(await readdir(path.join(dir, 'org/a'))).toEqual(['file.webp']);
  });
});
