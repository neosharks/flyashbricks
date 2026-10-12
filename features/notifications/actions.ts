'use server';

import { revalidatePath } from 'next/cache';
import { Types } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { formDataToObject, parseOrFail, runAction } from '@/lib/action';
import { ok, type ActionResult } from '@/lib/result';
import { NotFoundError } from '@/lib/errors';
import { requireUser } from '@/lib/session';
import { safeAppPath } from '@/lib/safe-path';
import { Notification } from '@/models/notification';
import { User } from '@/models/user';
import { NotificationIdSchema, PreferencesSchema } from './schema';

/**
 * Marks one of the caller's own notifications read and returns where it
 * leads. The target is re-checked as an in-app path before it is handed back,
 * so a stored link can never send anyone off-site.
 */
export async function openNotification(id: string): Promise<ActionResult<{ href: string }>> {
  return runAction('notifications.open', async () => {
    const viewer = await requireUser();
    const parsed = parseOrFail(NotificationIdSchema, { id });
    if (!parsed.ok) return parsed.result;

    await connectDb();
    const own = {
      _id: new Types.ObjectId(parsed.data.id),
      orgId: new Types.ObjectId(viewer.orgId),
      userId: new Types.ObjectId(viewer.id),
    };
    const notification = await Notification.findOne(own).select('href readAt').lean();
    if (notification && !notification.readAt) {
      // Only the first open stamps the time; later opens keep it.
      await Notification.updateOne({ ...own, readAt: null }, { $set: { readAt: new Date() } });
    }
    if (!notification) throw new NotFoundError('Notification');

    const href = safeAppPath(notification.href, '/notifications');
    return ok({ href });
  });
}

export async function markAllRead(): Promise<ActionResult> {
  return runAction('notifications.markAllRead', async () => {
    const viewer = await requireUser();
    await connectDb();
    await Notification.updateMany(
      {
        orgId: new Types.ObjectId(viewer.orgId),
        userId: new Types.ObjectId(viewer.id),
        readAt: null,
      },
      { $set: { readAt: new Date() } },
    );
    revalidatePath('/notifications');
    return ok();
  });
}

export async function markUnread(id: string): Promise<ActionResult> {
  return runAction('notifications.markUnread', async () => {
    const viewer = await requireUser();
    const parsed = parseOrFail(NotificationIdSchema, { id });
    if (!parsed.ok) return parsed.result;

    await connectDb();
    const result = await Notification.updateOne(
      { _id: parsed.data.id, orgId: viewer.orgId, userId: viewer.id },
      { $set: { readAt: null } },
    );
    if (result.matchedCount === 0) throw new NotFoundError('Notification');
    revalidatePath('/notifications');
    return ok();
  });
}

/** Each person sets their own; nobody changes anyone else's. */
export async function updatePreferences(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('notifications.updatePreferences', async () => {
    const viewer = await requireUser();
    const parsed = parseOrFail(PreferencesSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    await connectDb();
    await User.updateOne(
      { _id: viewer.id, orgId: viewer.orgId },
      { $set: { notificationPrefs: parsed.data } },
    );
    revalidatePath('/notifications/settings');
    return ok();
  });
}
