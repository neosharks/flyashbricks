// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Types } from '@/lib/mongoose';
import { ForbiddenError, NotFoundError, ValidationError, ConflictError } from '@/lib/errors';
import { NO_ACCESS, type SessionUser } from '@/lib/permissions';
import { clearTestDb, startTestDb, stopTestDb, syncIndexes } from '@/tests/db';
import { aUser } from '@/tests/factories';
import { Attendance } from '@/models/attendance';
import { StaffMember } from '@/models/staff-member';
import { StaffPayment } from '@/models/staff-payment';
import { AttendanceSheetSchema, CreateStaffSchema, foldSheet, StaffPaymentSchema } from './schema';

vi.mock('@/lib/db', () => ({ connectDb: () => Promise.resolve() }));

const service = await import('./service');
const queries = await import('./queries');

const TZ = 'Asia/Kolkata';

beforeAll(async () => {
  await startTestDb();
  await syncIndexes([StaffMember, Attendance, StaffPayment]);
}, 180_000);
afterEach(clearTestDb);
afterAll(stopTestDb);

async function anAdmin(orgId = new Types.ObjectId()): Promise<SessionUser> {
  const user = await aUser(orgId);
  return {
    id: user._id.toString(),
    orgId: orgId.toString(),
    name: user.name,
    role: 'admin',
    permissions: NO_ACCESS,
    mustChangePassword: false,
  };
}

function staffInput(overrides: Record<string, string> = {}) {
  return CreateStaffSchema.parse({
    name: 'Mahesh Yadav',
    nameHi: '',
    role: 'labour',
    gender: 'male',
    title: '',
    phone: '',
    wageType: 'daily',
    wageRatePaise: '500',
    overtimeRatePaise: '',
    joinedOn: '',
    leftOn: '',
    isActive: 'on',
    userId: '',
    address: '',
    notes: '',
    ...overrides,
  });
}

function sheet(date: string, marks: Record<string, string>) {
  const raw: Record<string, string> = { date };
  for (const [id, status] of Object.entries(marks)) raw[`att.${id}.status`] = status;
  return AttendanceSheetSchema.parse(foldSheet(raw));
}

describe('attendance', () => {
  it('re-marking a day replaces it instead of adding a second record', async () => {
    const admin = await anAdmin();
    const id = await service.createStaff(admin, staffInput(), TZ);

    await service.markAttendance(admin, sheet('2026-10-05', { [id]: 'present' }), TZ);
    await service.markAttendance(admin, sheet('2026-10-05', { [id]: 'half_day' }), TZ);

    const records = await Attendance.find({ staffId: id }).lean();
    expect(records).toHaveLength(1);
    expect(records[0]?.status).toBe('half_day');
  });

  it('clears a day marked by mistake', async () => {
    const admin = await anAdmin();
    const id = await service.createStaff(admin, staffInput(), TZ);
    await service.markAttendance(admin, sheet('2026-10-05', { [id]: 'present' }), TZ);
    await service.markAttendance(admin, sheet('2026-10-05', { [id]: 'none' }), TZ);
    expect(await Attendance.countDocuments({ staffId: id })).toBe(0);
  });

  it('refuses another organisation’s worker and future dates', async () => {
    const admin = await anAdmin();
    const other = await anAdmin();
    const foreign = await service.createStaff(other, staffInput({ name: 'Kailash Jat' }), TZ);

    await expect(
      service.markAttendance(admin, sheet('2026-10-05', { [foreign]: 'present' }), TZ),
    ).rejects.toBeInstanceOf(NotFoundError);
    const mine = await service.createStaff(admin, staffInput(), TZ);
    await expect(
      service.markAttendance(admin, sheet('2099-01-01', { [mine]: 'present' }), TZ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('builds the day’s sheet with everyone active and their marks', async () => {
    const admin = await anAdmin();
    const a = await service.createStaff(admin, staffInput({ name: 'Ajay' }), TZ);
    await service.createStaff(admin, staffInput({ name: 'Bhola' }), TZ);
    await service.markAttendance(admin, sheet('2026-10-05', { [a]: 'present' }), TZ);

    const rows = await queries.attendanceSheet(admin, '2026-10-05', TZ);
    expect(rows.map((row) => [row.name, row.status])).toEqual([
      ['Ajay', 'present'],
      ['Bhola', null],
    ]);
  });
});

describe('payments and balance', () => {
  it('owes earnings plus bonus less wages, advances and deductions; voids do not count', async () => {
    const admin = await anAdmin();
    const id = await service.createStaff(admin, staffInput({ wageRatePaise: '500' }), TZ);
    await service.markAttendance(admin, sheet('2026-10-01', { [id]: 'present' }), TZ);
    await service.markAttendance(admin, sheet('2026-10-02', { [id]: 'present' }), TZ);
    await service.markAttendance(admin, sheet('2026-10-03', { [id]: 'half_day' }), TZ);

    const pay = (type: string, amount: string) =>
      service.recordStaffPayment(
        admin,
        StaffPaymentSchema.parse({
          staffId: id,
          type,
          amount,
          mode: 'cash',
          date: '2026-10-04',
          periodFrom: '',
          periodTo: '',
          note: '',
        }),
        TZ,
      );
    await pay('advance', '300');
    await pay('bonus', '100');
    const mistake = await pay('wage', '1000');
    await service.voidStaffPayment(admin, { id: mistake, reason: 'Entered twice' });
    await expect(
      service.voidStaffPayment(admin, { id: mistake, reason: 'Again' }),
    ).rejects.toBeInstanceOf(ConflictError);

    const staff = await queries.getStaff(admin, id, TZ);
    if (!staff) throw new Error('missing staff');
    const month = await queries.staffMonth(admin, staff, '2026-10', TZ);
    // 2.5 days × ₹500 = ₹1,250 earned; + ₹100 bonus − ₹300 advance = ₹1,050.
    expect(month.summary.earnedPaise).toBe(125_000);
    expect(month.balancePaise).toBe(105_000);
  });

  it('never lets someone without staff access record pay', async () => {
    const admin = await anAdmin();
    const id = await service.createStaff(admin, staffInput(), TZ);
    const clerk: SessionUser = {
      ...admin,
      role: 'employee',
      permissions: { ...NO_ACCESS, staff: 'read' },
    };
    await expect(
      service.recordStaffPayment(
        clerk,
        StaffPaymentSchema.parse({
          staffId: id,
          type: 'advance',
          amount: '10',
          mode: 'cash',
          date: '2026-10-04',
          periodFrom: '',
          periodTo: '',
          note: '',
        }),
        TZ,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('payroll', () => {
  it('works out each person’s pay for the period, monthly salaries pro rata', async () => {
    const admin = await anAdmin();
    const daily = await service.createStaff(
      admin,
      staffInput({ name: 'Daily Worker', wageRatePaise: '600' }),
      TZ,
    );
    const monthly = await service.createStaff(
      admin,
      staffInput({
        name: 'Monthly Manager',
        wageType: 'monthly',
        wageRatePaise: '31000',
        role: 'manager',
      }),
      TZ,
    );
    for (const day of ['2026-10-01', '2026-10-02', '2026-10-03']) {
      await service.markAttendance(
        admin,
        sheet(day, { [daily]: 'present', [monthly]: 'present' }),
        TZ,
      );
    }

    const rows = await queries.payroll(admin, { from: '2026-10-01', to: '2026-10-31' }, TZ);
    const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
    expect(byName['Daily Worker']?.earnedPaise).toBe(180_000);
    // ₹31,000 over 31 days, 3 days worked.
    expect(byName['Monthly Manager']?.earnedPaise).toBe(300_000);
    expect(byName['Daily Worker']?.counts.present).toBe(3);
  });
});

describe('staff records', () => {
  it('rejects a phone already used by another worker, on the phone field', async () => {
    const admin = await anAdmin();
    await service.createStaff(admin, staffInput({ phone: '9829012345' }), TZ);
    const second = service.createStaff(
      admin,
      staffInput({ name: 'Other', phone: '9829012345' }),
      TZ,
    );
    await expect(second).rejects.toMatchObject({ fields: { phone: ['staffPhoneTaken'] } });
  });

  it('only links a login from the same organisation', async () => {
    const admin = await anAdmin();
    const stranger = await aUser(new Types.ObjectId());
    await expect(
      service.createStaff(admin, staffInput({ userId: stranger._id.toString() }), TZ),
    ).rejects.toMatchObject({ fields: { userId: ['invalid'] } });
  });

  it('finds people by either script and lists only this organisation', async () => {
    const admin = await anAdmin();
    const other = await anAdmin();
    await service.createStaff(admin, staffInput({ name: 'Ramesh Kumar' }), TZ);
    await service.createStaff(other, staffInput({ name: 'Ramesh Other' }), TZ);

    const params = {
      q: 'रमेश',
      sort: 'name' as const,
      dir: 'asc' as const,
      after: null,
      before: null,
      size: 25,
      status: 'active' as const,
      role: null,
    };
    const page = await queries.listStaff(admin, params, TZ);
    expect(page.rows.map((row) => row.name)).toEqual(['Ramesh Kumar']);
  });
});
