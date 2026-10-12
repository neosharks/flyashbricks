import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { connectDb } from '@/lib/db';
import { recordAudit } from '@/lib/audit';
import { reportUnexpected, withTrace } from '@/lib/logger';
import { getOrgTimezone } from '@/lib/org';
import { can } from '@/lib/permissions';
import { rateLimit } from '@/lib/rate-limit';
import { getSessionUser } from '@/lib/session';
import { CSV_BOM, csvRow, csvRupees } from '@/features/sales/csv';
import { parsePeriod } from '@/features/staff/period';
import { payroll } from '@/features/staff/queries';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * The wages table as CSV for the accountant. One row per person, amounts as
 * plain rupee numbers so the spreadsheet can add them; the same formula-
 * injection guard and byte-order mark as the sales export.
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
      const period = parsePeriod(query, timeZone);
      const [t, rows] = await Promise.all([
        getTranslations('staff'),
        payroll(user, { from: period.from, to: period.to }, timeZone),
      ]);

      await recordAudit({
        actor: user,
        action: 'staff_payment.export',
        entity: 'StaffMember',
        entityId: 'export',
        changes: { from: period.from, to: period.to, rows: rows.length },
      });

      let body = CSV_BOM;
      body += csvRow([
        t('payroll.columns.name'),
        t('form.role'),
        t('payroll.csv.wageType'),
        `${t('payroll.csv.rate')} (₹)`,
        t('payroll.csv.present'),
        t('payroll.csv.half'),
        t('payroll.csv.absent'),
        t('payroll.csv.leave'),
        t('payroll.csv.holiday'),
        t('payroll.csv.overtime'),
        t('payroll.csv.bricks'),
        `${t('payroll.columns.earned')} (₹)`,
        `${t('payroll.columns.bonus')} (₹)`,
        `${t('payment.types.advance')} (₹)`,
        `${t('payment.types.deduction')} (₹)`,
        `${t('payroll.columns.paid')} (₹)`,
        `${t('payroll.columns.balance')} (₹)`,
      ]);
      for (const row of rows) {
        body += csvRow([
          row.nameHi ? `${row.name} (${row.nameHi})` : row.name,
          t(`roles.${row.role}`),
          t(`wageTypes.${row.wageType}`),
          csvRupees(row.wageRatePaise),
          row.counts.present,
          row.counts.half_day,
          row.counts.absent,
          row.counts.leave,
          row.counts.holiday,
          Math.round((row.counts.overtimeMinutes / 60) * 100) / 100,
          row.counts.bricks,
          csvRupees(row.earnedPaise),
          csvRupees(row.payments.bonus),
          csvRupees(row.payments.advance),
          csvRupees(row.payments.deduction),
          csvRupees(row.payments.wage),
          csvRupees(row.balancePaise),
        ]);
      }

      return new Response(body, {
        headers: {
          ...NO_STORE,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="wages-${period.from}-to-${period.to}.csv"`,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (err) {
      const traceId = reportUnexpected(err, 'payroll export failed');
      return NextResponse.json({ error: 'failed', traceId }, { status: 500, headers: NO_STORE });
    }
  });
}
