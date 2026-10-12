import 'server-only';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/lib/audit';
import { reportUnexpected } from '@/lib/logger';
import { can, type SessionUser } from '@/lib/permissions';
import { rateLimit } from '@/lib/rate-limit';
import { getSessionUser } from '@/lib/session';
import { CSV_BOM, csvRow } from './csv';

/** Enough for years of sales; a bigger export belongs in a backup, not a spreadsheet. */
export const MAX_EXPORT_ROWS = 50_000;

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Authenticates and authorizes an export request. Route Handlers are public
 * URLs: the session and the permission are checked here, not assumed.
 */
export async function exportGate(): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE }),
    };
  }
  if (!can(user, 'sales:read')) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE }),
    };
  }
  const limited = await rateLimit('export', user.id);
  if (!limited.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { ...NO_STORE, 'Retry-After': String(limited.resetSeconds) } },
      ),
    };
  }
  return { ok: true, user };
}

/**
 * Streams CSV rows from a database cursor, so a large export never sits in
 * memory whole. The audit entry is written before the first byte.
 */
export async function csvResponse<Doc>(options: {
  user: SessionUser;
  action: 'sale.export' | 'customer.export';
  entity: 'Sale' | 'Customer';
  filename: string;
  header: string[];
  cursor: AsyncIterable<Doc>;
  toRow: (doc: Doc) => (string | number | null)[];
  filters: Record<string, unknown>;
}): Promise<Response> {
  await recordAudit({
    actor: options.user,
    action: options.action,
    entity: options.entity,
    entityId: 'export',
    changes: options.filters,
  });

  const encoder = new TextEncoder();
  const iterator = options.cursor[Symbol.asyncIterator]();
  let count = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(CSV_BOM + csvRow(options.header)));
    },
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done || count >= MAX_EXPORT_ROWS) {
          await iterator.return?.();
          controller.close();
          return;
        }
        count += 1;
        controller.enqueue(encoder.encode(csvRow(options.toRow(next.value))));
      } catch (err) {
        reportUnexpected(err, 'csv export failed', { action: options.action });
        controller.error(err);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });

  return new Response(stream, {
    headers: {
      ...NO_STORE,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${options.filename}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
