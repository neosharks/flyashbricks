import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { connectDb } from '@/lib/db';
import { recordAudit } from '@/lib/audit';
import { dayKey } from '@/lib/dates';
import { reportUnexpected, withTrace } from '@/lib/logger';
import { getOrgTimezone } from '@/lib/org';
import { can } from '@/lib/permissions';
import { rateLimit } from '@/lib/rate-limit';
import { getSessionUser } from '@/lib/session';
import { CSV_BOM, csvRow, csvRupees } from '@/features/sales/csv';
import {
  exportPaymentsCursor,
  parsePaymentsFilters,
  staffBriefs,
} from '@/features/staff/payments-report';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
/** Years of a plant's staff payments; anything bigger belongs in a backup. */
const MAX_ROWS = 50_000;

/**
 * The "Money paid" list as CSV, with the screen's period and filters. One row
 * per payment, cancelled ones included and marked, amounts as plain rupees;
 * the same formula-injection guard and byte-order mark as the other exports.
 */
export async function GET(request: Request): Promise<Response> {
  return withTrace(async () => {
    const user = await getSessionUser();
    if (!user || user.mustChangePassword) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    }
    if (!can(user, 'staff:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
    }
    const limited = await rateLimit('export', user.id);
    if (!limited.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { ...NO_STORE, 'Retry-After': String(limited.resetSeconds) } },
      );
    }

    try {
      await connectDb();
      const timeZone = await getOrgTimezone(user.orgId);
      const query = Object.fromEntries(new URL(request.url).searchParams.entries());
      const filters = parsePaymentsFilters(query, timeZone);
      const q = (query.q ?? '').slice(0, 80);
      const t = await getTranslations('staff');

      const rows = [];
      const cursor = await exportPaymentsCursor(user, filters, q, timeZone, MAX_ROWS);
      for await (const payment of cursor) rows.push(payment);
      const briefs = await staffBriefs(
        user,
        rows.map((row) => row.staffId.toString()),
      );

      await recordAudit({
        actor: user,
        action: 'staff_payment.export',
        entity: 'StaffMember',
        entityId: 'export',
        changes: { from: filters.from, to: filters.to, rows: rows.length },
      });

      let body =
        CSV_BOM +
        csvRow([
          t('payments.columns.date'),
          t('payments.columns.person'),
          t('payments.csv.role'),
          t('payments.columns.type'),
          `${t('payments.columns.amount')} (₹)`,
          t('payments.columns.mode'),
          t('payments.csv.status'),
          t('payments.csv.note'),
          t('payments.columns.by'),
        ]);
      for (const row of rows) {
        const brief = briefs.get(row.staffId.toString());
        body += csvRow([
          dayKey(row.paidOn, timeZone),
          brief ? (brief.nameHi ? `${brief.name} (${brief.nameHi})` : brief.name) : '',
          brief ? t(`roles.${brief.role}`) : '',
          t(`payment.types.${row.type}`),
          csvRupees(row.amountPaise),
          t(`payment.modes.${row.mode}`),
          row.voidedAt ? t('payments.csv.cancelled') : t('payments.csv.active'),
          row.voidedAt ? (row.voidReason ?? '') : (row.note ?? ''),
          row.recordedByName,
        ]);
      }

      return new Response(body, {
        headers: {
          ...NO_STORE,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="staff-payments-${filters.from}-to-${filters.to}.csv"`,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (err) {
      const traceId = reportUnexpected(err, 'staff payments export failed');
      return NextResponse.json({ error: 'failed', traceId }, { status: 500, headers: NO_STORE });
    }
  });
}
