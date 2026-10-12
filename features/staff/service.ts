import 'server-only';
import { Types, type ObjectId } from '@/lib/mongoose';
import { recordAudit } from '@/lib/audit';
import { startOfDay, todayKey } from '@/lib/dates';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { can, type SessionUser } from '@/lib/permissions';
import { searchTerms } from '@/lib/utils';
import { Attendance } from '@/models/attendance';
import { StaffMember } from '@/models/staff-member';
import { StaffPayment } from '@/models/staff-payment';
import { User } from '@/models/user';
import type {
  AttendanceSheetInput,
  CreateStaffInput,
  StaffPaymentInput,
  UpdateStaffInput,
  VoidStaffPaymentInput,
} from './schema';
import { nextAvatarVariant } from '@/features/people/avatar';

function assertCan(actor: SessionUser, action: 'staff:write'): void {
  if (!can(actor, action)) throw new ForbiddenError();
}

function assertNotFuture(key: string, timeZone: string, field: string): void {
  if (key > todayKey(timeZone))
    throw new ValidationError('Date in the future', { [field]: ['futureDate'] });
}

function isDuplicateKey(
  err: unknown,
): err is { code: 11000; keyPattern?: Record<string, unknown> } {
  return (err as { code?: unknown } | null)?.code === 11000;
}

/** Turns a unique-index clash into an error on the field that caused it. */
function duplicateError(err: { keyPattern?: Record<string, unknown> }): ValidationError {
  return err.keyPattern && 'userId' in err.keyPattern
    ? new ValidationError('Login already linked', { userId: ['loginAlreadyLinked'] })
    : new ValidationError('Phone already used', { phone: ['staffPhoneTaken'] });
}

/** A linked login must belong to the same organisation; anything else is refused outright. */
async function assertLoginInOrg(orgId: ObjectId, userId: string | null): Promise<void> {
  if (!userId) return;
  const exists = await User.exists({ _id: userId, orgId });
  if (!exists) throw new ValidationError('Unknown login', { userId: ['invalid'] });
}

function documentFields(input: CreateStaffInput, timeZone: string) {
  const { joinedOn, leftOn, userId, ...rest } = input;
  return {
    ...rest,
    // The schema requires one script and fills the other, so both are present here.
    name: rest.name ?? '',
    joinedOn: joinedOn ? startOfDay(joinedOn, timeZone) : null,
    leftOn: leftOn ? startOfDay(leftOn, timeZone) : null,
    // Someone with a leaving date has left, whatever the switch says.
    isActive: leftOn ? false : rest.isActive,
    userId: userId ? new Types.ObjectId(userId) : null,
    searchTerms: searchTerms(rest.name, rest.nameHi, rest.title, rest.phone),
  };
}

export async function createStaff(
  actor: SessionUser,
  input: CreateStaffInput,
  timeZone: string,
): Promise<string> {
  assertCan(actor, 'staff:write');
  const orgId = new Types.ObjectId(actor.orgId);
  await assertLoginInOrg(orgId, input.userId);

  try {
    const created = await StaffMember.create({
      ...documentFields(input, timeZone),
      orgId,
      avatarVariant: await nextAvatarVariant(actor.orgId),
      createdBy: new Types.ObjectId(actor.id),
    });
    await recordAudit({
      actor,
      action: 'staff.create',
      entity: 'StaffMember',
      entityId: created._id.toString(),
      changes: {
        name: input.name,
        role: input.role,
        wageType: input.wageType,
        wageRatePaise: input.wageRatePaise,
      },
    });
    return created._id.toString();
  } catch (err) {
    if (isDuplicateKey(err)) throw duplicateError(err);
    throw err;
  }
}

export async function updateStaff(
  actor: SessionUser,
  input: UpdateStaffInput,
  timeZone: string,
): Promise<void> {
  assertCan(actor, 'staff:write');
  const orgId = new Types.ObjectId(actor.orgId);
  const { id, ...fields } = input;
  await assertLoginInOrg(orgId, fields.userId);

  try {
    const result = await StaffMember.updateOne(
      { _id: new Types.ObjectId(id), orgId },
      { $set: documentFields(fields, timeZone) },
      { runValidators: true },
    );
    if (result.matchedCount === 0) throw new NotFoundError('Staff member');
  } catch (err) {
    if (isDuplicateKey(err)) throw duplicateError(err);
    throw err;
  }

  await recordAudit({
    actor,
    action: 'staff.update',
    entity: 'StaffMember',
    entityId: id,
    changes: {
      name: fields.name,
      role: fields.role,
      wageRatePaise: fields.wageRatePaise,
      isActive: fields.isActive,
    },
  });
}

export type SheetResult = { marked: number; cleared: number };

/**
 * Saves a day's attendance for many people in one round trip. Each person's
 * day is an upsert on the unique (person, day) key, so saving the sheet twice,
 * or two supervisors saving at once, leaves exactly one record per person.
 * `none` removes a day marked by mistake.
 */
export async function markAttendance(
  actor: SessionUser,
  input: AttendanceSheetInput,
  timeZone: string,
): Promise<SheetResult> {
  assertCan(actor, 'staff:write');
  assertNotFuture(input.date, timeZone, 'date');
  const orgId = new Types.ObjectId(actor.orgId);
  const date = startOfDay(input.date, timeZone);

  // Every id must be one of this organisation's staff; a foreign id is a forged request.
  const ids = [...new Set(input.entries.map((entry) => entry.staffId))];
  const known = await StaffMember.countDocuments({
    orgId,
    _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
  });
  if (known !== ids.length) throw new NotFoundError('Staff member');

  const markedBy = new Types.ObjectId(actor.id);
  const operations = input.entries.map((entry) => {
    const key = { orgId, staffId: new Types.ObjectId(entry.staffId), date };
    if (entry.status === 'none') return { deleteOne: { filter: key } };
    return {
      updateOne: {
        filter: key,
        update: {
          $set: {
            status: entry.status,
            overtimeMinutes: entry.overtimeMinutes,
            bricks: entry.bricks,
            markedBy,
          },
          $setOnInsert: { note: null },
        },
        upsert: true,
      },
    };
  });
  await Attendance.bulkWrite(operations, { ordered: false });

  const counts: Record<string, number> = {};
  for (const entry of input.entries) counts[entry.status] = (counts[entry.status] ?? 0) + 1;
  await recordAudit({
    actor,
    action: 'attendance.mark',
    entity: 'StaffMember',
    entityId: ids.length === 1 ? (ids[0] ?? 'sheet') : 'sheet',
    changes: { date: input.date, ...counts },
  });

  const cleared = counts.none ?? 0;
  return { marked: input.entries.length - cleared, cleared };
}

export async function recordStaffPayment(
  actor: SessionUser,
  input: StaffPaymentInput,
  timeZone: string,
): Promise<string> {
  assertCan(actor, 'staff:write');
  assertNotFuture(input.date, timeZone, 'date');
  const orgId = new Types.ObjectId(actor.orgId);
  const staff = await StaffMember.findOne({ _id: new Types.ObjectId(input.staffId), orgId })
    .select('name')
    .lean();
  if (!staff) throw new NotFoundError('Staff member');

  const created = await StaffPayment.create({
    orgId,
    staffId: staff._id,
    type: input.type,
    amountPaise: input.amount,
    mode: input.mode,
    paidOn: startOfDay(input.date, timeZone),
    periodFrom: input.periodFrom ? startOfDay(input.periodFrom, timeZone) : null,
    periodTo: input.periodTo ? startOfDay(input.periodTo, timeZone) : null,
    note: input.note,
    recordedBy: new Types.ObjectId(actor.id),
    recordedByName: actor.name,
  });

  await recordAudit({
    actor,
    action: 'staff_payment.create',
    entity: 'StaffMember',
    entityId: staff._id.toString(),
    changes: { name: staff.name, type: input.type, amountPaise: input.amount, mode: input.mode },
  });
  return created._id.toString();
}

/** Payments are never edited or deleted; a mistake is voided with a reason and leaves the totals. */
export async function voidStaffPayment(
  actor: SessionUser,
  input: VoidStaffPaymentInput,
): Promise<void> {
  assertCan(actor, 'staff:write');
  const orgId = new Types.ObjectId(actor.orgId);
  const payment = await StaffPayment.findOne({ _id: new Types.ObjectId(input.id), orgId }).lean();
  if (!payment) throw new NotFoundError('Payment');

  const result = await StaffPayment.updateOne(
    { _id: payment._id, orgId, voidedAt: null },
    { $set: { voidedAt: new Date(), voidReason: input.reason } },
  );
  if (result.modifiedCount === 0)
    throw new ConflictError('ALREADY_VOIDED', 'Payment already voided');

  await recordAudit({
    actor,
    action: 'staff_payment.void',
    entity: 'StaffMember',
    entityId: payment.staffId.toString(),
    changes: { type: payment.type, amountPaise: payment.amountPaise, reason: input.reason },
  });
}
