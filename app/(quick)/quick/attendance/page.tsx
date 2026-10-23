import type { Metadata } from 'next';
import { QuickAttendance } from '@/components/quick/quick-attendance';
import { attendanceSheet } from '@/features/staff/queries';
import { todayKey } from '@/lib/dates';
import { getOrgTimezone } from '@/lib/org';
import { requirePermissionPage } from '@/lib/session';

export const metadata: Metadata = { title: 'Attendance' };

export default async function QuickAttendancePage() {
  const user = await requirePermissionPage('/quick/attendance', 'staff:write');
  const timezone = await getOrgTimezone(user.orgId);
  const today = todayKey(timezone);
  const rows = await attendanceSheet(user, today, timezone);
  // People who have left only appear when they were already marked today.
  return <QuickAttendance rows={rows.filter((row) => row.isActive || row.status)} today={today} />;
}
