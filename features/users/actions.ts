'use server';

import { revalidatePath } from 'next/cache';
import { Types } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { formDataToObject, parseOrFail, runAction } from '@/lib/action';
import { fail, ok, type ActionResult } from '@/lib/result';
import { ConflictError, ForbiddenError, NotFoundError, RateLimitError } from '@/lib/errors';
import { requirePermission } from '@/lib/session';
import { canGrant, canManageUser, NO_ACCESS, type SessionUser } from '@/lib/permissions';
import { hashPassword } from '@/lib/password';
import { generateTemporaryPassword, temporaryPasswordExpiry } from '@/lib/ids';
import { rateLimit } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';
import { User, type UserDoc } from '@/models/user';
import { notify } from '@/features/notifications/notify';
import { nextAvatarVariant } from '@/features/people/avatar';
import { defaultPrefs } from '@/features/notifications/prefs';
import { revokeDevicePins } from '@/features/auth/device-pin';
import { CreateUserSchema, foldPermissions, UpdateUserSchema, UserIdSchema } from './schema';

function isDuplicateKey(
  err: unknown,
): err is { code: 11000; keyPattern?: Record<string, unknown> } {
  return (err as { code?: unknown } | null)?.code === 11000;
}

/** Turns a unique-index clash into the message the form can show next to the field. */
function duplicateError(err: { keyPattern?: Record<string, unknown> }): ConflictError {
  return err.keyPattern && 'email' in err.keyPattern
    ? new ConflictError('EMAIL_IN_USE', 'Email already in use')
    : new ConflictError('PHONE_IN_USE', 'Phone already in use');
}

async function throttle(actor: SessionUser): Promise<void> {
  const limited = await rateLimit('userAdmin', actor.id);
  if (!limited.success) throw new RateLimitError(limited.resetSeconds);
}

/**
 * Loads a user in the actor's organisation that the actor may manage.
 *
 * An employee who manages logins may only manage people whose access is no
 * greater than their own. Without that, they could reset a more powerful
 * colleague's password, sign in as them and take over their access.
 */
async function loadManageable(actor: SessionUser, id: string) {
  const target = await User.findOne({ _id: id, orgId: actor.orgId }).lean();
  if (!target) throw new NotFoundError('User');
  const manageable = canManageUser(actor, {
    orgId: target.orgId.toString(),
    role: target.role,
    permissions: { ...NO_ACCESS, ...target.permissions },
  });
  if (!manageable) throw new ForbiddenError();
  return target;
}

/** Refuses any change that would leave the organisation without an active admin. */
async function assertAnotherAdmin(target: UserDoc): Promise<void> {
  if (target.role !== 'admin' || target.disabledAt) return;
  const others = await User.countDocuments({
    orgId: target.orgId,
    role: 'admin',
    disabledAt: null,
    _id: { $ne: target._id },
  });
  if (others === 0) throw new ConflictError('LAST_ADMIN', 'Last admin');
}

export async function createUser(
  _prev: ActionResult<{ id: string; temporaryPassword: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; temporaryPassword: string }>> {
  return runAction('users.create', async () => {
    const actor = await requirePermission('users:write');
    await throttle(actor);

    const parsed = parseOrFail(CreateUserSchema, foldPermissions(formDataToObject(formData)));
    if (!parsed.ok) return parsed.result;
    if (!canGrant(actor, parsed.data.role, parsed.data.permissions)) throw new ForbiddenError();

    await connectDb();
    const temporaryPassword = generateTemporaryPassword();

    let created;
    try {
      created = await User.create({
        ...parsed.data,
        orgId: new Types.ObjectId(actor.orgId),
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: true,
        temporaryPasswordExpiresAt: temporaryPasswordExpiry(),
        notificationPrefs: defaultPrefs(parsed.data.role),
        // New people get the next cartoon in the organisation's rotation.
        avatarVariant: await nextAvatarVariant(actor.orgId),
        createdBy: new Types.ObjectId(actor.id),
      });
    } catch (err) {
      if (isDuplicateKey(err)) throw duplicateError(err);
      throw err;
    }

    await recordAudit({
      actor,
      action: 'user.create',
      entity: 'User',
      entityId: created._id.toString(),
      changes: {
        name: parsed.data.name,
        role: parsed.data.role,
        permissions: parsed.data.permissions,
        pinSignInAllowed: parsed.data.pinSignInAllowed,
      },
    });

    await notify({
      orgId: actor.orgId,
      type: 'employee_added',
      params: {
        name: parsed.data.name,
        nameHi: parsed.data.nameHi ?? parsed.data.name,
        by: actor.name,
      },
      href: `/users/${created._id.toString()}`,
      excludeUserId: actor.id,
    });

    revalidatePath('/users');
    // Shown once to the admin and never stored in readable form.
    return ok({ id: created._id.toString(), temporaryPassword });
  });
}

export async function updateUser(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('users.update', async () => {
    const actor = await requirePermission('users:write');
    await throttle(actor);

    const parsed = parseOrFail(UpdateUserSchema, foldPermissions(formDataToObject(formData)));
    if (!parsed.ok) return parsed.result;
    const { id, ...changes } = parsed.data;

    await connectDb();
    const target = await loadManageable(actor, id);
    // "Not set" is allowed only to stay as it was; nobody can be set back to it.
    if (changes.gender === 'unspecified' && target.gender !== 'unspecified') {
      return fail('VALIDATION_FAILED', 'Gender required', { fields: { gender: ['chooseGender'] } });
    }
    if (!canGrant(actor, changes.role, changes.permissions)) throw new ForbiddenError();

    const pinChanged = changes.pinSignInAllowed !== target.pinSignInAllowed;
    const accessChanged =
      changes.role !== target.role ||
      JSON.stringify(changes.permissions) !== JSON.stringify({ ...target.permissions }) ||
      pinChanged;

    if (accessChanged && id === actor.id) {
      throw new ConflictError('CANNOT_CHANGE_SELF', 'Cannot change own access');
    }
    if (changes.role !== 'admin') await assertAnotherAdmin(target);

    try {
      await User.updateOne(
        { _id: target._id, orgId: actor.orgId },
        { $set: changes },
        { runValidators: true },
      );
    } catch (err) {
      if (isDuplicateKey(err)) throw duplicateError(err);
      throw err;
    }
    if (!changes.pinSignInAllowed) await revokeDevicePins(target.orgId, target._id);

    await recordAudit({
      actor,
      action: accessChanged ? 'user.access_change' : 'user.update',
      entity: 'User',
      entityId: id,
      changes: {
        name: changes.name,
        ...(accessChanged
          ? { role: { from: target.role, to: changes.role }, permissions: changes.permissions }
          : {}),
        ...(pinChanged
          ? { pinSignInAllowed: { from: target.pinSignInAllowed, to: changes.pinSignInAllowed } }
          : {}),
      },
    });

    revalidatePath('/users');
    revalidatePath(`/users/${id}`);
    return ok();
  });
}

/** Issues a new temporary password; every existing session for the user ends. */
export async function resetUserPassword(
  id: string,
): Promise<ActionResult<{ temporaryPassword: string }>> {
  return runAction('users.resetPassword', async () => {
    const actor = await requirePermission('users:write');
    await throttle(actor);

    const parsed = parseOrFail(UserIdSchema, { id });
    if (!parsed.ok) return parsed.result;

    await connectDb();
    const target = await loadManageable(actor, parsed.data.id);
    if (target._id.toString() === actor.id) {
      throw new ConflictError('CANNOT_CHANGE_SELF', 'Use your account page');
    }

    const temporaryPassword = generateTemporaryPassword();
    await User.updateOne(
      { _id: target._id, orgId: actor.orgId },
      {
        $set: {
          passwordHash: await hashPassword(temporaryPassword),
          mustChangePassword: true,
          temporaryPasswordExpiresAt: temporaryPasswordExpiry(),
          sessionsValidFrom: new Date(),
        },
      },
    );
    await revokeDevicePins(target.orgId, target._id);

    await recordAudit({
      actor,
      action: 'user.password_reset',
      entity: 'User',
      entityId: parsed.data.id,
    });
    revalidatePath(`/users/${parsed.data.id}`);
    return ok({ temporaryPassword });
  });
}

export async function setUserDisabled(id: string, disabled: boolean): Promise<ActionResult> {
  return runAction('users.setDisabled', async () => {
    const actor = await requirePermission('users:write');
    await throttle(actor);

    const parsed = parseOrFail(UserIdSchema, { id });
    if (!parsed.ok) return parsed.result;

    await connectDb();
    const target = await loadManageable(actor, parsed.data.id);
    if (target._id.toString() === actor.id) {
      throw new ConflictError('CANNOT_CHANGE_SELF', 'Cannot disable yourself');
    }
    if (disabled) await assertAnotherAdmin(target);

    await User.updateOne(
      { _id: target._id, orgId: actor.orgId },
      disabled
        ? { $set: { disabledAt: new Date(), sessionsValidFrom: new Date() } }
        : { $set: { disabledAt: null } },
    );
    if (disabled) await revokeDevicePins(target.orgId, target._id);

    await recordAudit({
      actor,
      action: disabled ? 'user.disable' : 'user.enable',
      entity: 'User',
      entityId: parsed.data.id,
    });
    revalidatePath('/users');
    revalidatePath(`/users/${parsed.data.id}`);
    return ok();
  });
}

/** Ends every session the user has open, on every device. */
export async function signOutUserEverywhere(id: string): Promise<ActionResult> {
  return runAction('users.signOutEverywhere', async () => {
    const actor = await requirePermission('users:write');
    await throttle(actor);

    const parsed = parseOrFail(UserIdSchema, { id });
    if (!parsed.ok) return parsed.result;

    await connectDb();
    const target = await loadManageable(actor, parsed.data.id);
    await User.updateOne(
      { _id: target._id, orgId: actor.orgId },
      { $set: { sessionsValidFrom: new Date() } },
    );
    await revokeDevicePins(target.orgId, target._id);

    await recordAudit({
      actor,
      action: 'user.sign_out_everywhere',
      entity: 'User',
      entityId: parsed.data.id,
    });
    return ok();
  });
}
