import { describe, expect, it } from 'vitest';
import { AttendanceSheetSchema, CreateStaffSchema, foldSheet, StaffPaymentSchema } from './schema';

const ID_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const ID_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';

const base = {
  name: 'Mahesh Yadav',
  nameHi: '',
  role: 'labour',
  gender: 'male',
  title: '',
  phone: '',
  wageType: 'daily',
  wageRatePaise: '550',
  overtimeRatePaise: '',
  joinedOn: '',
  leftOn: '',
  isActive: 'on',
  userId: '',
  address: '',
  notes: '',
};

describe('CreateStaffSchema', () => {
  it('fills the Hindi name, keeps the phone optional and stores rates in paise', () => {
    const parsed = CreateStaffSchema.parse(base);
    expect(parsed.nameHi).toBe('महेश यादव');
    expect(parsed.phone).toBeNull();
    expect(parsed.wageRatePaise).toBe(55_000);
    expect(parsed.overtimeRatePaise).toBeNull();
    expect(parsed.userId).toBeNull();
  });

  it('accepts a Hindi-only name and fills the English one', () => {
    const parsed = CreateStaffSchema.parse({ ...base, name: '', nameHi: 'रमेश' });
    expect(parsed.name).toBe('Ramesh');
  });

  it('flags a name typed in the wrong script', () => {
    const result = CreateStaffSchema.safeParse({ ...base, name: 'रमेश', nameHi: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('mustBeEnglish');
  });

  it('normalises a phone when given and rejects a bad one', () => {
    expect(CreateStaffSchema.parse({ ...base, phone: '+91 98290 12345' }).phone).toBe('9829012345');
    expect(CreateStaffSchema.safeParse({ ...base, phone: '12345' }).success).toBe(false);
  });

  it('refuses a leaving date before the joining date, and unknown fields', () => {
    expect(
      CreateStaffSchema.safeParse({ ...base, joinedOn: '2026-05-01', leftOn: '2026-04-01' })
        .success,
    ).toBe(false);
    expect(CreateStaffSchema.safeParse({ ...base, orgId: 'x' }).success).toBe(false);
  });
});

describe('attendance sheet', () => {
  it('folds per-person fields and skips people left unmarked', () => {
    const folded = foldSheet({
      date: '2026-10-12',
      [`att.${ID_A}.status`]: 'present',
      [`att.${ID_A}.ot`]: '1.5',
      [`att.${ID_A}.bricks`]: '',
      [`att.${ID_B}.status`]: '',
    });
    const parsed = AttendanceSheetSchema.parse(folded);
    expect(parsed.entries).toEqual([
      { staffId: ID_A, status: 'present', overtimeMinutes: 90, bricks: 0 },
    ]);
  });

  it('needs at least one person marked', () => {
    expect(AttendanceSheetSchema.safeParse(foldSheet({ date: '2026-10-12' })).success).toBe(false);
  });

  it('rejects impossible overtime and unknown statuses', () => {
    const tooLong = foldSheet({
      date: '2026-10-12',
      [`att.${ID_A}.status`]: 'present',
      [`att.${ID_A}.ot`]: '30',
    });
    expect(AttendanceSheetSchema.safeParse(tooLong).success).toBe(false);
    const odd = foldSheet({ date: '2026-10-12', [`att.${ID_A}.status`]: 'sleeping' });
    expect(AttendanceSheetSchema.safeParse(odd).success).toBe(false);
  });
});

describe('StaffPaymentSchema', () => {
  it('takes rupees and refuses zero or a backwards period', () => {
    const ok = StaffPaymentSchema.parse({
      staffId: ID_A,
      type: 'advance',
      amount: '2,000',
      mode: 'cash',
      date: '2026-10-12',
      periodFrom: '',
      periodTo: '',
      note: '',
    });
    expect(ok.amount).toBe(200_000);
    expect(StaffPaymentSchema.safeParse({ ...ok, amount: '0' }).success).toBe(false);
    expect(
      StaffPaymentSchema.safeParse({
        ...ok,
        amount: '10',
        periodFrom: '2026-10-10',
        periodTo: '2026-10-01',
      }).success,
    ).toBe(false);
  });
});
