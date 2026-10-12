import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Page } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { AttendanceSheet } from '@/components/staff/attendance-sheet';
import { DayPicker } from '@/components/staff/day-picker';
import { StaffTabs } from '@/components/staff/staff-tabs';
import { attendanceSheet } from '@/features/staff/queries';
import { DAY_KEY_PATTERN, todayKey } from '@/lib/dates';
import { getOrgTimezone } from '@/lib/org';
import { can } from '@/lib/permissions';
import { requirePermissionPage } from '@/lib/session';

export const metadata: Metadata = { title: 'Attendance' };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requirePermissionPage('/staff/attendance', 'staff:read');
  const query = await searchParams;
  const timeZone = await getOrgTimezone(viewer.orgId);
  const today = todayKey(timeZone);
  const raw = Array.isArray(query.date) ? query.date[0] : query.date;
  // A future or malformed date in the URL falls back to today.
  const date = raw && DAY_KEY_PATTERN.test(raw) && raw <= today ? raw : today;

  const [t, rows] = await Promise.all([
    getTranslations('staff'),
    attendanceSheet(viewer, date, timeZone),
  ]);

  return (
    <Page size="narrow">
      <PageHeader title={t('sheet.title')} description={t('sheet.description')} />
      <StaffTabs current="attendance" />
      <div className="mb-4">
        <DayPicker date={date} today={today} label={t('sheet.date')} />
      </div>
      {/* Keyed by day so switching days starts from that day's saved marks. */}
      <AttendanceSheet
        key={date}
        rows={rows}
        date={date}
        today={today}
        canWrite={can(viewer, 'staff:write')}
      />
    </Page>
  );
}
