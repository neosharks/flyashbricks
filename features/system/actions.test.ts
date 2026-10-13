// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/lib/errors';

const mocks = vi.hoisted(() => ({
  env: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    APP_VERSION: 'v0.2.0',
    UPDATE_REPO: 'neosharks/flyashbricks',
    UPDATER_DIR: undefined as string | undefined,
  },
  requirePermission: vi.fn(),
  fetchLatestRelease: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ env: mocks.env }));
vi.mock('@/lib/db', () => ({ connectDb: () => Promise.resolve() }));
vi.mock('@/lib/session', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/lib/audit', () => ({ recordAudit: mocks.recordAudit }));
vi.mock('./releases', () => ({ fetchLatestRelease: mocks.fetchLatestRelease }));
vi.mock('next-intl/server', () => ({
  getTranslations: () => Promise.resolve(Object.assign((key: string) => key, { has: () => false })),
}));

const { requestUpdate } = await import('./actions');

const admin = { id: 'u1', orgId: 'o1', name: 'Asha', role: 'admin' };
const release = (version: string) => ({
  version,
  name: version,
  url: `https://github.com/neosharks/flyashbricks/releases/tag/${version}`,
  notes: '',
  publishedAt: null,
});

describe('requestUpdate', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'flyash-action-'));
    await writeFile(path.join(dir, 'agent.json'), '{"installed":true}');
    mocks.env.UPDATER_DIR = dir;
    mocks.env.APP_VERSION = 'v0.2.0';
    mocks.requirePermission.mockResolvedValue(admin);
    mocks.fetchLatestRelease.mockReset().mockResolvedValue(release('v0.3.0'));
    mocks.recordAudit.mockReset();
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('hands the newest release to the host and records who asked', async () => {
    const result = await requestUpdate('v0.3.0');

    expect(result).toEqual({ ok: true, data: { version: 'v0.3.0' } });
    expect(mocks.requirePermission).toHaveBeenCalledWith('system:update');
    const request = JSON.parse(await readFile(path.join(dir, 'request.json'), 'utf8')) as {
      version: string;
      requestedBy: string;
    };
    expect(request).toMatchObject({ version: 'v0.3.0', requestedBy: 'Asha' });
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'system.update',
        entityId: 'v0.3.0',
        changes: { from: 'v0.2.0', to: 'v0.3.0' },
      }),
    );
  });

  it('is refused to anyone without the permission', async () => {
    mocks.requirePermission.mockRejectedValue(new ForbiddenError());
    expect(await requestUpdate('v0.3.0')).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  it('says so when no updater is installed', async () => {
    mocks.env.UPDATER_DIR = undefined;
    expect(await requestUpdate('v0.3.0')).toMatchObject({
      ok: false,
      code: 'UPDATER_UNAVAILABLE',
    });
  });

  it('will not queue a second update while one runs', async () => {
    await writeFile(
      path.join(dir, 'status.json'),
      '{"state":"running","version":"v0.3.0","from":"v0.2.0","startedAt":null,"finishedAt":null}',
    );
    expect(await requestUpdate('v0.3.0')).toMatchObject({ ok: false, code: 'UPDATE_IN_PROGRESS' });
  });

  it('only installs the release that is newest right now', async () => {
    mocks.fetchLatestRelease.mockResolvedValue(release('v0.4.0'));
    expect(await requestUpdate('v0.3.0')).toMatchObject({
      ok: false,
      code: 'UPDATE_VERSION_CHANGED',
    });
  });

  it('never downgrades or reinstalls', async () => {
    mocks.env.APP_VERSION = 'v0.3.0';
    expect(await requestUpdate('v0.3.0')).toMatchObject({ ok: false, code: 'ALREADY_UP_TO_DATE' });
  });

  it('rejects anything that is not a release tag before touching the disk', async () => {
    expect(await requestUpdate('main')).toMatchObject({
      ok: false,
      code: 'UPDATE_VERSION_CHANGED',
    });
    expect(mocks.fetchLatestRelease).not.toHaveBeenCalled();
  });
});
