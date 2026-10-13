// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isBusy, readUpdaterState, writeUpdateRequest } from './updater';

describe('updater folder', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'flyash-updater-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('is unavailable without a folder or an installed agent', async () => {
    expect((await readUpdaterState(undefined)).available).toBe(false);
    expect((await readUpdaterState(dir)).available).toBe(false);
  });

  it('reports an idle updater once the agent is installed', async () => {
    await writeFile(path.join(dir, 'agent.json'), '{"installed":true}');
    const state = await readUpdaterState(dir);
    expect(state).toEqual({ available: true, pending: false, status: null, log: '' });
    expect(isBusy(state)).toBe(false);
  });

  it('reads the status and the end of the log the host writes', async () => {
    await writeFile(path.join(dir, 'agent.json'), '{"installed":true}');
    await writeFile(
      path.join(dir, 'status.json'),
      '{"state":"running","version":"v0.3.0","from":"v0.2.0","startedAt":"2026-10-13T10:00:00+05:30","finishedAt":null}',
    );
    await writeFile(path.join(dir, 'update.log'), `${'x'.repeat(40_000)}\nlast line\n`);

    const state = await readUpdaterState(dir);
    expect(state.status).toMatchObject({ state: 'running', version: 'v0.3.0', from: 'v0.2.0' });
    expect(isBusy(state)).toBe(true);
    expect(state.log.length).toBeLessThanOrEqual(16 * 1024);
    expect(state.log.endsWith('last line\n')).toBe(true);
  });

  it('ignores a status file it cannot understand', async () => {
    await writeFile(path.join(dir, 'agent.json'), '{"installed":true}');
    await writeFile(path.join(dir, 'status.json'), '{"state":"exploded"');
    expect((await readUpdaterState(dir)).status).toBeNull();
  });

  it('writes a request with the version first, which the host script relies on', async () => {
    await writeUpdateRequest(dir, { version: 'v0.3.0', requestedBy: 'Asha "Admin"' });
    const text = await readFile(path.join(dir, 'request.json'), 'utf8');
    expect(text.startsWith('{"version":"v0.3.0"')).toBe(true);
    expect(JSON.parse(text)).toMatchObject({ version: 'v0.3.0', requestedBy: 'Asha "Admin"' });
  });

  it('refuses a second request while one is waiting', async () => {
    await writeUpdateRequest(dir, { version: 'v0.3.0', requestedBy: 'A' });
    await expect(writeUpdateRequest(dir, { version: 'v0.3.0', requestedBy: 'B' })).rejects.toThrow(
      /already waiting/,
    );
  });

  it('refuses anything that is not a release tag', async () => {
    await expect(
      writeUpdateRequest(dir, { version: 'main; rm -rf /', requestedBy: 'A' }),
    ).rejects.toThrow(/Not a release tag/);
  });
});
