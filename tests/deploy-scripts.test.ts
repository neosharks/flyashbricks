// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SETUP = path.resolve('deploy/proxmox/setup.sh');
const INSTALL = path.resolve('deploy/proxmox/install.sh');

/** Sources setup.sh with a fixed LAN address and runs write_env into `file`. */
function writeEnv(file: string, env: Record<string, string> = {}): void {
  execFileSync(
    'bash',
    ['-c', `source "${SETUP}"; primary_ip() { echo 192.168.1.50; }; write_env "$0"`, file],
    { env: { ...process.env, APP_DOMAIN: '', MAIL_FROM: '', SMTP_URL: '', ...env } },
  );
}

function parse(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .split('\n')
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
}

describe('Proxmox install scripts', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'flyash-deploy-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('are valid bash', () => {
    for (const script of [SETUP, INSTALL]) {
      expect(() => execFileSync('bash', ['-n', script])).not.toThrow();
    }
  });

  it('serves a LAN install on the machine IP with a certificate Caddy signs itself', async () => {
    const file = path.join(dir, '.env.production');
    writeEnv(file);
    const env = parse(await readFile(file, 'utf8'));

    expect(env.APP_DOMAIN).toBe('192.168.1.50');
    expect(env.APP_TLS).toBe('tls internal');
    expect(env.MAIL_FROM).toBe('alerts@flyashbricks.local');
    expect(env.MAIL_TRANSPORT).toBe('console');
  });

  it('uses a public certificate and the domain for mail when a domain is given', async () => {
    const file = path.join(dir, '.env.production');
    writeEnv(file, {
      APP_DOMAIN: 'bricks.example.in',
      SMTP_URL: 'smtps://u:p@smtp.example.in:465',
    });
    const env = parse(await readFile(file, 'utf8'));

    expect(env.APP_DOMAIN).toBe('bricks.example.in');
    expect(env.APP_TLS).toBe('');
    expect(env.MAIL_FROM).toBe('alerts@bricks.example.in');
    expect(env.MAIL_TRANSPORT).toBe('smtp');
  });

  it('generates distinct secrets in a file only its owner can read', async () => {
    const file = path.join(dir, '.env.production');
    writeEnv(file);
    const env = parse(await readFile(file, 'utf8'));

    // Hex: these go inside connection URLs.
    for (const key of ['MONGO_ROOT_PASSWORD', 'MONGO_APP_PASSWORD', 'REDIS_PASSWORD']) {
      expect(env[key], key).toMatch(/^[0-9a-f]{64}$/);
    }
    for (const key of ['AUTH_SECRET', 'CRON_SECRET']) {
      expect(env[key], key).toMatch(/^[A-Za-z0-9+/=]{64}$/);
    }
    const secrets = [
      env.AUTH_SECRET,
      env.CRON_SECRET,
      env.MONGO_ROOT_PASSWORD,
      env.MONGO_APP_PASSWORD,
      env.REDIS_PASSWORD,
    ];
    expect(new Set(secrets).size).toBe(secrets.length);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });
});
