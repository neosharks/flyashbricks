// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SETUP = path.resolve('deploy/proxmox/setup.sh');
const INSTALL = path.resolve('deploy/proxmox/install.sh');
const PACKAGE = path.resolve('scripts/package-release.sh');

/**
 * Sources setup.sh with its folders moved into `dir` (and the app's group set
 * to the current user's, so `chgrp` works without root), then runs `script`.
 */
function runSetup(dir: string, script: string, env: Record<string, string> = {}): string {
  const group = execFileSync('id', ['-gn'], { encoding: 'utf8' }).trim();
  return execFileSync(
    'bash',
    [
      '-c',
      `source "${SETUP}"
       CONFIG_DIR="$0"; CONFIG="$0/env"; DATA="$0/data"; UPDATER_DIR="$0"; APP_USER="${group}"
       ${script}`,
      dir,
    ],
    { env: { ...process.env, APP_URL: '', SMTP_URL: '', MAIL_FROM: '', ...env }, encoding: 'utf8' },
  );
}

/** Reads KEY="value" lines, as systemd and Node's --env-file do. */
function parse(text: string): Record<string, string> {
  return Object.fromEntries(
    [...text.matchAll(/^([A-Z_]+)="(.*)"$/gm)].map((match) => [match[1] ?? '', match[2] ?? '']),
  );
}

describe('server setup script', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'flyash-deploy-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('are valid bash', () => {
    for (const script of [SETUP, INSTALL, PACKAGE]) {
      expect(() => execFileSync('bash', ['-n', script])).not.toThrow();
    }
  });

  describe('settings file', () => {
    beforeEach(async () => {
      await writeFile(path.join(dir, '.mongo-app'), 'a'.repeat(64));
    });

    it('points the app at its public address behind the tunnel', async () => {
      runSetup(dir, 'write_config', { APP_URL: 'https://bricks.example.in/' });
      const env = parse(await readFile(path.join(dir, 'env'), 'utf8'));

      expect(env).toMatchObject({
        NODE_ENV: 'production',
        APP_URL: 'https://bricks.example.in',
        AUTH_URL: 'https://bricks.example.in',
        CLIENT_IP_HEADER: 'cf-connecting-ip',
        MAIL_TRANSPORT: 'console',
        MAIL_FROM: 'alerts@bricks.example.in',
        NEXT_PUBLIC_APP_NAME: 'Fly Ash Bricks',
      });
      expect(env.MONGODB_URI).toBe(
        `mongodb://flyash_app:${'a'.repeat(64)}@127.0.0.1:27017/flyash?replicaSet=rs0&authSource=admin`,
      );
    });

    it('generates distinct secrets readable by root and the app only, then drops the password file', async () => {
      runSetup(dir, 'write_config', { APP_URL: 'https://bricks.example.in' });
      const file = path.join(dir, 'env');
      const env = parse(await readFile(file, 'utf8'));

      for (const key of ['AUTH_SECRET', 'CRON_SECRET']) {
        expect(env[key], key).toMatch(/^[A-Za-z0-9+/=]{64}$/);
      }
      expect(env.AUTH_SECRET).not.toBe(env.CRON_SECRET);
      expect((await stat(file)).mode & 0o777).toBe(0o640);
      await expect(stat(path.join(dir, '.mongo-app'))).rejects.toThrow();
    });

    it('sends real email when an SMTP server is given', async () => {
      runSetup(dir, 'write_config', {
        APP_URL: 'https://bricks.example.in',
        SMTP_URL: 'smtps://u:p@smtp.example.in:465',
      });
      expect(parse(await readFile(path.join(dir, 'env'), 'utf8')).MAIL_TRANSPORT).toBe('smtp');
    });

    it('refuses an address that is not https', () => {
      expect(() =>
        runSetup(dir, 'write_config 2>/dev/null', { APP_URL: 'http://192.168.1.7:3000' }),
      ).toThrow();
    });

    it('never overwrites existing settings', async () => {
      await writeFile(path.join(dir, 'env'), 'KEEP="me"\n');
      runSetup(dir, 'write_config', { APP_URL: 'https://bricks.example.in' });
      expect(await readFile(path.join(dir, 'env'), 'utf8')).toBe('KEEP="me"\n');
    });
  });

  describe('updater', () => {
    it('takes the version only from the start of the request file', async () => {
      const request = path.join(dir, 'request.json');
      const read = async (content: string) => {
        await writeFile(request, content);
        return runSetup(dir, `requested_version "${request}"`).trim();
      };

      expect(await read('{"version":"v0.3.0","requestedBy":"Asha"}')).toBe('v0.3.0');
      expect(await read('{"requestedBy":"x","version":"v9.9.9"}')).toBe('');
      expect(await read('{"version":"main; reboot"}')).toBe('');
      expect(await read('{"version":"v1.2.3$(reboot)"}')).toBe('');
    });

    it('writes a status file the app can parse', async () => {
      runSetup(dir, 'write_status running v0.3.0 v0.2.0 2026-10-13T10:00:00+05:30');
      const file = path.join(dir, 'status.json');
      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
        state: 'running',
        version: 'v0.3.0',
        from: 'v0.2.0',
        startedAt: '2026-10-13T10:00:00+05:30',
        finishedAt: null,
      });

      runSetup(dir, 'write_status succeeded v0.3.0 v0.2.0 2026-10-13T10:00:00+05:30 done-at');
      expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({
        state: 'succeeded',
        finishedAt: 'done-at',
      });
    });

    it('reads the newest release from the redirect GitHub answers with', () => {
      const latest = (location: string) =>
        runSetup(
          dir,
          `curl() { printf 'HTTP/2 302\\r\\nlocation: ${location}\\r\\n\\r\\n'; }; latest_release`,
        );

      expect(latest('https://github.com/neosharks/flyashbricks/releases/tag/v0.3.0')).toBe(
        'v0.3.0\n',
      );
      expect(latest('https://github.com/neosharks/flyashbricks/releases/tag/nightly')).toBe('');
      expect(latest('https://github.com/neosharks/flyashbricks/releases')).toBe('');
    });
  });
});
