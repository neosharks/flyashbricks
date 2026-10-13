// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rateLimit } from './rate-limit';

describe('rate limit without Redis', () => {
  afterEach(() => vi.useRealTimers());

  it('allows the budget, then refuses until the window passes', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-13T10:00:00Z') });
    const id = `ip-${Math.random()}`;
    for (let i = 0; i < 5; i++) expect((await rateLimit('login', id)).success).toBe(true);

    const blocked = await rateLimit('login', id);
    expect(blocked.success).toBe(false);
    expect(blocked.resetSeconds).toBeGreaterThan(0);

    vi.advanceTimersByTime(61_000);
    expect((await rateLimit('login', id)).success).toBe(true);
  });

  it('keeps budgets separate per identifier and per bucket', async () => {
    const id = `ip-${Math.random()}`;
    for (let i = 0; i < 5; i++) await rateLimit('login', id);
    expect((await rateLimit('login', `${id}-other`)).success).toBe(true);
    expect((await rateLimit('write', id)).success).toBe(true);
  });
});
