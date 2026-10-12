import 'server-only';
import { Types, type ClientSession, type ObjectId } from '@/lib/mongoose';
import { can, NO_ACCESS, type SessionUser } from '@/lib/permissions';
import { enqueue } from '@/lib/outbox';
import { isSafeAppPath } from '@/lib/safe-path';
import { logger } from '@/lib/logger';
import { User } from '@/models/user';
import { Notification, type NotificationParams } from '@/models/notification';
import type { NotificationType } from '@/models/constants';
import { NOTIFICATION_TYPE_META } from './registry';
import { resolvePrefs } from './prefs';
import { availableChannels } from './channels';

export type NotifyInput = {
  orgId: string;
  type: NotificationType;
  params: NotificationParams;
  /** In-app path the notification opens, e.g. `/sales/<id>`. */
  href: string;
  /** The person who caused it already knows; they are left out. */
  excludeUserId?: string | null;
  /** At most one notification per person with this key (daily digests). */
  dedupeKey?: string;
};

/**
 * Fans one event out to everyone in the organisation who may see it.
 *
 * Inside a transaction the inbox rows and the delivery jobs commit with the
 * business change, so a rolled-back sale never announces itself. Email, SMS
 * and WhatsApp are never sent here — they go through the outbox, so a slow
 * gateway cannot slow down saving a sale.
 */
export async function notify(input: NotifyInput, session?: ClientSession): Promise<number> {
  if (!isSafeAppPath(input.href)) {
    throw new Error(`notify: href must be an in-app path, got ${String(input.href)}`);
  }
  const meta = NOTIFICATION_TYPE_META[input.type];
  const orgId = new Types.ObjectId(input.orgId);

  const users = await User.find({ orgId, disabledAt: null })
    .select('orgId name role permissions notificationPrefs')
    .session(session ?? null)
    .lean();

  const recipients = users.filter((user) => {
    if (input.excludeUserId && user._id.toString() === input.excludeUserId) return false;
    const asSession: SessionUser = {
      id: user._id.toString(),
      orgId: input.orgId,
      name: user.name,
      role: user.role,
      permissions: { ...NO_ACCESS, ...user.permissions },
      mustChangePassword: false,
    };
    return can(asSession, meta.audience);
  });
  if (recipients.length === 0) return 0;

  const channels = availableChannels();
  let created = 0;

  for (const user of recipients) {
    const doc = {
      orgId,
      userId: user._id,
      type: input.type,
      category: meta.category,
      severity: meta.severity,
      params: input.params,
      href: input.href,
      dedupeKey: input.dedupeKey ?? null,
      readAt: null,
      deliveries: [],
    };

    let notificationId: ObjectId | null;
    if (input.dedupeKey) {
      // Upsert so a re-run of a digest job cannot notify anyone twice.
      const result = await Notification.updateOne(
        { userId: user._id, dedupeKey: input.dedupeKey },
        { $setOnInsert: doc },
        { upsert: true, ...(session ? { session } : {}) },
      );
      notificationId = result.upsertedId ?? null;
    } else {
      const [inserted] = await Notification.create([doc], session ? { session } : {});
      notificationId = inserted?._id ?? null;
    }
    if (!notificationId) continue;
    created += 1;

    const prefs = resolvePrefs(user.notificationPrefs, user.role)[meta.category];
    const wantsExternal = (['email', 'sms', 'whatsapp'] as const).some(
      (channel) => prefs[channel] && channels[channel],
    );
    if (wantsExternal) {
      await enqueue('notification.deliver', { notificationId: notificationId.toString() }, session);
    }
  }

  logger.info({ type: input.type, recipients: created }, 'notification sent');
  return created;
}
