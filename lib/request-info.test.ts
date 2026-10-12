// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { clientIp } from './request-info';

describe('clientIp', () => {
  it('takes the address the one trusted proxy saw', () => {
    expect(clientIp('203.0.113.7', null, 1)).toBe('203.0.113.7');
  });

  it('ignores addresses a client put in the header itself', () => {
    expect(clientIp('1.1.1.1, 203.0.113.7', null, 1)).toBe('203.0.113.7');
    expect(clientIp('1.1.1.1, 2.2.2.2 ,203.0.113.7', null, 1)).toBe('203.0.113.7');
  });

  it('counts back one entry per trusted proxy', () => {
    // client-supplied, real client (added by Cloudflare), Cloudflare (added by Caddy)
    expect(clientIp('1.1.1.1, 203.0.113.7, 172.70.1.1', null, 2)).toBe('203.0.113.7');
  });

  it('trusts nothing when the chain is shorter than the proxies configured', () => {
    expect(clientIp('203.0.113.7', null, 2)).toBeNull();
    expect(clientIp(' , ', null, 1)).toBeNull();
  });

  it('ignores the proxy headers entirely when no proxy is trusted', () => {
    expect(clientIp('203.0.113.7', '198.51.100.1', 0)).toBeNull();
  });

  it('falls back to X-Real-IP only when there is no X-Forwarded-For', () => {
    expect(clientIp(null, '198.51.100.1', 1)).toBe('198.51.100.1');
    expect(clientIp(null, null, 1)).toBeNull();
    expect(clientIp('203.0.113.7', '198.51.100.1', 1)).toBe('203.0.113.7');
  });
});
