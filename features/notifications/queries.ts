import 'server-only';
import { getLocale, getTranslations } from 'next-intl/server';
import { Types, type QueryFilter } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { dateToIso, idToString } from '@/lib/dto';
import type { SessionUser } from '@/lib/permissions';
import { keysetPage, type Page, type TableParams } from '@/lib/table';
import { Notification, type NotificationDoc } from '@/models/notification';
import { User } from '@/models/user';
import type { NotificationCategory } from '@/models/constants';
import { displayParams, renderNotification, type Translate } from './render';
import { resolvePrefs } from './prefs';
import type { NotificationItem } from './types';

export const NOTIFICATION_SORTS = ['createdAt'] as const;

/** Renders documents in the current request's language. */
async function renderer() {
  const [t, units, locale] = await Promise.all([
    getTranslations('notifications'),
    getTranslations('common.units'),
    getLocale(),
  ]);
  const translate = t as unknown as Translate;
  const unitLabel = (unit: string) => (units as unknown as Translate)(unit);

  return (doc: NotificationDoc): NotificationItem => {
    const { title, body } = renderNotification(
      translate,
      doc.type,
      displayParams(doc.params, locale, unitLabel),
    );
    return {
      id: idToString(doc._id),
      type: doc.type,
      category: doc.category,
      severity: doc.severity,
      title,
      body,
      href: doc.href,
      read: doc.readAt !== null,
      createdAt: dateToIso(doc.createdAt),
    };
  };
}

function ownFilter(viewer: SessionUser): QueryFilter<NotificationDoc> {
  return { orgId: new Types.ObjectId(viewer.orgId), userId: new Types.ObjectId(viewer.id) };
}

export async function listNotifications(
  viewer: SessionUser,
  params: TableParams<'createdAt'> & {
    unreadOnly: boolean;
    category: NotificationCategory | null;
  },
): Promise<Page<NotificationItem>> {
  await connectDb();
  const filter = ownFilter(viewer);
  if (params.unreadOnly) filter.readAt = null;
  if (params.category) filter.category = params.category;

  const [page, render] = await Promise.all([keysetPage(Notification, filter, params), renderer()]);
  return { ...page, rows: page.rows.map(render) };
}

export async function unreadCount(viewer: SessionUser): Promise<number> {
  await connectDb();
  // Capped: the badge shows "99+" beyond this, so counting further is wasted work.
  return Notification.countDocuments({ ...ownFilter(viewer), readAt: null }, { limit: 100 });
}

export async function latestNotifications(viewer: SessionUser, limit = 8) {
  await connectDb();
  const [docs, render] = await Promise.all([
    Notification.find(ownFilter(viewer)).sort({ createdAt: -1, _id: -1 }).limit(limit).lean(),
    renderer(),
  ]);
  return docs.map(render);
}

/** Only ever the viewer's own notification; anyone else's id is simply "not found". */
export async function getOwnNotification(viewer: SessionUser, id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDb();
  return Notification.findOne({ _id: id, ...ownFilter(viewer) })
    .select('href readAt')
    .lean();
}

export async function getPreferences(viewer: SessionUser) {
  await connectDb();
  const user = await User.findById(viewer.id).select('email phone role notificationPrefs').lean();
  if (!user) return null;
  return {
    prefs: resolvePrefs(user.notificationPrefs, user.role),
    hasEmail: Boolean(user.email),
  };
}
