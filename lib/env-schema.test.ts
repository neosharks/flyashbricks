// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseServerEnv } from './env-schema';

const BASE = {
  // vitest.config.ts skips validation for every other test; this one is about it.
  SKIP_ENV_VALIDATION: 'false',
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017/flyash',
  AUTH_SECRET: 'a'.repeat(32),
  CRON_SECRET: 'b'.repeat(16),
  UPDATER_DIR: '/var/lib/flyashbricks/updater',
};

function parseWith(values: Record<string, string>) {
  for (const [key, value] of Object.entries({ ...BASE, ...values })) vi.stubEnv(key, value);
  return parseServerEnv();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('server environment', () => {
  it('keeps demo sign-ins off unless asked', () => {
    const env = parseWith({});
    expect(env.DEMO_LOGINS).toBe(false);
    expect(env.UPDATER_DIR).toBe(BASE.UPDATER_DIR);
  });

  it('turns in-app updates off on a demo server, whose admin password is public', () => {
    const env = parseWith({ DEMO_LOGINS: 'true' });
    expect(env.DEMO_LOGINS).toBe(true);
    expect(env.UPDATER_DIR).toBeUndefined();
  });
});
