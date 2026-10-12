'use server';

import { revalidatePath } from 'next/cache';
import { formDataToObject, parseOrFail, runAction } from '@/lib/action';
import { connectDb } from '@/lib/db';
import { ValidationError } from '@/lib/errors';
import { getOrgTimezone } from '@/lib/org';
import { rateLimit } from '@/lib/rate-limit';
import { RateLimitError } from '@/lib/errors';
import { fail, ok, type ActionResult } from '@/lib/result';
import { requirePermission } from '@/lib/session';
import {
  AttendanceSheetSchema,
  CreateStaffSchema,
  foldSheet,
  StaffPaymentSchema,
  UpdateStaffSchema,
  VoidStaffPaymentSchema,
} from './schema';
import {
  createStaff,
  markAttendance,
  recordStaffPayment,
  updateStaff,
  voidStaffPayment,
  type SheetResult,
} from './service';

/**
 * Field-level failures from the service (a phone already used, a login
 * already linked) come back as field errors, so the form can show them next
 * to the right box.
 */
async function withFieldErrors<T>(body: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await body();
  } catch (err) {
    if (err instanceof ValidationError && err.fields) {
      return fail('VALIDATION_FAILED', err.message, { fields: err.fields });
    }
    throw err;
  }
}

async function throttle(userId: string): Promise<void> {
  const limited = await rateLimit('write', userId);
  if (!limited.success) throw new RateLimitError(limited.resetSeconds);
}

export async function createStaffAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction('staff.create', () =>
    withFieldErrors(async () => {
      const actor = await requirePermission('staff:write');
      await throttle(actor.id);
      const parsed = parseOrFail(CreateStaffSchema, formDataToObject(formData));
      if (!parsed.ok) return parsed.result;
      await connectDb();
      const id = await createStaff(actor, parsed.data, await getOrgTimezone(actor.orgId));
      revalidatePath('/staff');
      return ok({ id });
    }),
  );
}

export async function updateStaffAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction('staff.update', () =>
    withFieldErrors(async () => {
      const actor = await requirePermission('staff:write');
      await throttle(actor.id);
      const parsed = parseOrFail(UpdateStaffSchema, formDataToObject(formData));
      if (!parsed.ok) return parsed.result;
      await connectDb();
      await updateStaff(actor, parsed.data, await getOrgTimezone(actor.orgId));
      revalidatePath('/staff');
      revalidatePath(`/staff/${parsed.data.id}`);
      return ok({ id: parsed.data.id });
    }),
  );
}

export async function markAttendanceAction(
  _prev: ActionResult<SheetResult> | null,
  formData: FormData,
): Promise<ActionResult<SheetResult>> {
  return runAction('attendance.mark', () =>
    withFieldErrors(async () => {
      const actor = await requirePermission('staff:write');
      await throttle(actor.id);
      const parsed = parseOrFail(AttendanceSheetSchema, foldSheet(formDataToObject(formData)));
      if (!parsed.ok) return parsed.result;
      await connectDb();
      const result = await markAttendance(actor, parsed.data, await getOrgTimezone(actor.orgId));
      revalidatePath('/staff', 'layout');
      return ok(result);
    }),
  );
}

export async function recordStaffPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('staff_payment.create', () =>
    withFieldErrors(async () => {
      const actor = await requirePermission('staff:write');
      await throttle(actor.id);
      const parsed = parseOrFail(StaffPaymentSchema, formDataToObject(formData));
      if (!parsed.ok) return parsed.result;
      await connectDb();
      await recordStaffPayment(actor, parsed.data, await getOrgTimezone(actor.orgId));
      revalidatePath('/staff', 'layout');
      return ok();
    }),
  );
}

export async function voidStaffPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('staff_payment.void', async () => {
    const actor = await requirePermission('staff:write');
    const parsed = parseOrFail(VoidStaffPaymentSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;
    await connectDb();
    await voidStaffPayment(actor, parsed.data);
    revalidatePath('/staff', 'layout');
    return ok();
  });
}
