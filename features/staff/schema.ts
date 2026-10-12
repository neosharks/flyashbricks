import { z } from 'zod';
import { bilingualFields } from '@/lib/bilingual';
import { checkbox, dayKey, objectId, optionalText, rupees, rupeesOrZero } from '@/lib/form-schema';
import { normalizePhone } from '@/lib/phone';
import {
  ATTENDANCE_STATUSES,
  PAYMENT_MODES,
  STAFF_PAYMENT_TYPES,
  STAFF_ROLES,
  WAGE_TYPES,
} from '@/models/constants';

/** Largest attendance sheet saved in one go: far above any brick yard's headcount. */
export const MAX_SHEET_ENTRIES = 500;

const blankToNull = (value: unknown) =>
  value === '' || value === undefined || value === null ? null : value;

const nameField = bilingualFields('name', { max: 120, required: true, min: 2 });

/** Optional for workers: many labourers share a phone or have none. */
const optionalPhone = z.preprocess(
  blankToNull,
  z
    .string()
    .nullable()
    .transform((value, ctx) => {
      if (value === null) return null;
      const phone = normalizePhone(value);
      if (!phone) {
        ctx.addIssue({ code: 'custom', message: 'invalidPhone' });
        return z.NEVER;
      }
      return phone;
    }),
);

const optionalDay = z.preprocess(blankToNull, dayKey().nullable());
const optionalRupees = z.preprocess(blankToNull, rupees().nullable());

const staffFields = {
  ...nameField.shape,
  role: z.enum(STAFF_ROLES, 'invalid'),
  // Asked for everyone; 'unspecified' exists only on records from before it was asked.
  gender: z.enum(['male', 'female', 'other'], 'required'),
  title: optionalText(80),
  phone: optionalPhone,
  wageType: z.enum(WAGE_TYPES, 'invalid'),
  wageRatePaise: rupeesOrZero(),
  overtimeRatePaise: optionalRupees,
  joinedOn: optionalDay,
  leftOn: optionalDay,
  isActive: checkbox(),
  userId: z.preprocess(blankToNull, objectId().nullable()),
  address: optionalText(300),
  notes: optionalText(1000),
};

function refineStaff(value: Record<string, unknown>, ctx: z.RefinementCtx): void {
  nameField.requireOne(value, ctx);
  const joined = value.joinedOn as string | null;
  const left = value.leftOn as string | null;
  if (joined && left && left < joined) {
    ctx.addIssue({ code: 'custom', path: ['leftOn'], message: 'leftBeforeJoined' });
  }
}

export const CreateStaffSchema = z
  .object(staffFields)
  .strict()
  .superRefine(refineStaff)
  .transform((value) => ({ ...value, ...nameField.complete(value) }));
export type CreateStaffInput = z.infer<typeof CreateStaffSchema>;

export const UpdateStaffSchema = z
  .object({ id: objectId(), ...staffFields })
  .strict()
  .superRefine(refineStaff)
  .transform((value) => ({ ...value, ...nameField.complete(value) }));
export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;

/** `none` clears a day that was marked by mistake. */
export const SHEET_STATUSES = [...ATTENDANCE_STATUSES, 'none'] as const;

const SheetEntrySchema = z
  .object({
    staffId: objectId(),
    status: z.enum(SHEET_STATUSES, 'invalid'),
    /** Hours as typed ("1.5"), stored as whole minutes. */
    overtimeHours: z.preprocess(
      (value) => (value === '' || value === undefined ? 0 : value),
      z.coerce.number('invalid').min(0, 'tooSmall').max(16, 'tooBig'),
    ),
    bricks: z.preprocess(
      (value) =>
        value === '' || value === undefined
          ? 0
          : typeof value === 'string'
            ? value.replace(/[,\s]/g, '')
            : value,
      z.coerce.number('invalid').int('invalid').min(0, 'tooSmall').max(100_000, 'tooBig'),
    ),
  })
  .strict()
  .transform(({ overtimeHours, ...rest }) => ({
    ...rest,
    overtimeMinutes: Math.round(overtimeHours * 60),
  }));

/**
 * The attendance sheet posts flat fields per person — `att.<staffId>.status`,
 * `att.<staffId>.ot`, `att.<staffId>.bricks` — folded into entries here.
 * People left unmarked post nothing and are not touched.
 */
export function foldSheet(raw: Record<string, unknown>): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  const rows = new Map<string, Record<string, unknown>>();
  for (const [key, value] of Object.entries(raw)) {
    const match = /^att\.([a-f\d]{24})\.(status|ot|bricks)$/i.exec(key);
    if (!match) {
      rest[key] = value;
      continue;
    }
    const staffId = match[1] ?? '';
    const row = rows.get(staffId) ?? { staffId };
    const field = match[2] === 'ot' ? 'overtimeHours' : (match[2] ?? '');
    row[field] = value;
    rows.set(staffId, row);
  }
  const entries = [...rows.values()].filter((row) => row.status !== undefined && row.status !== '');
  return { ...rest, entries };
}

export const AttendanceSheetSchema = z
  .object({
    date: dayKey(),
    entries: z.array(SheetEntrySchema).min(1, 'nothingMarked').max(MAX_SHEET_ENTRIES, 'tooBig'),
  })
  .strict();
export type AttendanceSheetInput = z.infer<typeof AttendanceSheetSchema>;

export const StaffPaymentSchema = z
  .object({
    staffId: objectId(),
    type: z.enum(STAFF_PAYMENT_TYPES, 'invalid'),
    amount: rupees({ min: 1 }),
    mode: z.enum(PAYMENT_MODES, 'invalid'),
    date: dayKey(),
    periodFrom: optionalDay,
    periodTo: optionalDay,
    note: optionalText(300),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.periodFrom && value.periodTo && value.periodTo < value.periodFrom) {
      ctx.addIssue({ code: 'custom', path: ['periodTo'], message: 'periodBackwards' });
    }
  });
export type StaffPaymentInput = z.infer<typeof StaffPaymentSchema>;

export const VoidStaffPaymentSchema = z
  .object({
    id: objectId(),
    reason: z.string('required').trim().min(3, 'required').max(300, 'tooBig'),
  })
  .strict();
export type VoidStaffPaymentInput = z.infer<typeof VoidStaffPaymentSchema>;
