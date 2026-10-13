import 'server-only';
import { headers } from 'next/headers';
import { env } from '@/lib/env';

/**
 * Picks the client address out of the proxy headers.
 *
 * Each proxy appends the address it received the request from to
 * X-Forwarded-For, so only the last `hops` entries were written by proxies we
 * run; everything to their left came from the client and may be invented.
 * The entry `hops` from the right is therefore the real client. With no
 * trusted proxy (`hops` 0) the header is ignored entirely.
 */
export function clientIp(
  forwardedFor: string | null,
  realIp: string | null,
  hops: number,
): string | null {
  if (hops <= 0) return null;
  if (forwardedFor !== null) {
    const entries = forwardedFor
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '');
    // Fewer entries than proxies means the request skipped one: trust none of it.
    return entries.length >= hops ? (entries[entries.length - hops] ?? null) : null;
  }
  const trimmed = realIp?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}

/**
 * Cloudflare sets CF-Connecting-IP to the visitor's address, overwriting
 * anything the visitor sent, so behind a Cloudflare Tunnel it is the one
 * header to read. The tunnel connector must then be the only way in.
 */
export function cloudflareIp(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}

/** Validated in production; under SKIP_ENV_VALIDATION (build, tests) the raw string, if any. */
function trustedHops(): number {
  const hops = Number((env.TRUSTED_PROXY_HOPS as number | string | undefined) ?? 1);
  return Number.isInteger(hops) && hops >= 0 ? hops : 1;
}

/**
 * Client address and agent for audit and login records.
 *
 * `CLIENT_IP_HEADER=cf-connecting-ip` behind a Cloudflare Tunnel (what
 * deploy/proxmox/setup.sh sets up); otherwise X-Forwarded-For, counting
 * `TRUSTED_PROXY_HOPS` proxies from the right. See docs/security.md.
 */
export async function requestInfo(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const list = await headers();
    const ip =
      env.CLIENT_IP_HEADER === 'cf-connecting-ip'
        ? cloudflareIp(list.get('cf-connecting-ip'))
        : clientIp(list.get('x-forwarded-for'), list.get('x-real-ip'), trustedHops());
    return {
      ip: ip?.slice(0, 64) ?? null,
      userAgent: list.get('user-agent')?.slice(0, 300) ?? null,
    };
  } catch {
    // Outside a request scope (cron, scripts) there is nothing to record.
    return { ip: null, userAgent: null };
  }
}
