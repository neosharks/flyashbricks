'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { connectDb } from '@/lib/db';
import { parseOrFail, runAction } from '@/lib/action';
import { ok, type ActionResult } from '@/lib/result';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { requireUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { objectId } from '@/lib/form-schema';
import { recordAudit } from '@/lib/audit';
import { AVATAR_VARIANTS } from '@/models/constants';
import { User } from '@/models/user';
import { StaffMember } from '@/models/staff-member';

const ChoosePictureSchema = z
  .object({
    kind: z.enum(['user', 'staff'], 'invalid'),
    id: objectId(),
    variant: z
      .number()
      .int()
      .min(0)
      .max(AVATAR_VARIANTS - 1),
  })
  .strict();

/**
 * Picks a different cartoon picture. Anyone may change their own; changing
 * someone else's needs the right to edit them (`users:write` over that user,
 * or `staff:write` for staff records).
 */
export async function chooseCartoon(input: {
  kind: 'user' | 'staff';
  id: string;
  variant: number;
}): Promise<ActionResult> {
  return runAction('people.chooseCartoon', async () => {
    const actor = await requireUser();
    const parsed = parseOrFail(ChoosePictureSchema, input);
    if (!parsed.ok) return parsed.result;
    const { kind, id, variant } = parsed.data;

    await connectDb();
    if (kind === 'user') {
      const target = await User.findOne({ _id: id, orgId: actor.orgId }).select('role').lean();
      if (!target) throw new NotFoundError('User');
      const self = target._id.toString() === actor.id;
      if (!self && !can(actor, 'users:write', { orgId: actor.orgId, targetRole: target.role })) {
        throw new ForbiddenError();
      }
      await User.updateOne(
        { _id: target._id, orgId: actor.orgId },
        { $set: { avatarVariant: variant } },
      );
      revalidatePath(`/users/${id}`);
    } else {
      if (!can(actor, 'staff:write')) throw new ForbiddenError();
      const result = await StaffMember.updateOne(
        { _id: id, orgId: actor.orgId },
        { $set: { avatarVariant: variant } },
      );
      if (result.matchedCount === 0) throw new NotFoundError('Staff member');
      revalidatePath(`/staff/${id}`);
    }

    await recordAudit({
      actor,
      action: kind === 'user' ? 'user.photo_change' : 'staff.photo_change',
      entity: kind === 'user' ? 'User' : 'StaffMember',
      entityId: id,
      changes: { cartoon: variant },
    });
    return ok();
  });
}
