import type { Role } from '@/lib/permissions';
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from '@/models/constants';
import type { ChannelPrefs, NotificationPrefs } from '@/models/user';

const OFF: ChannelPrefs = { email: false, sms: false, whatsapp: false };

/**
 * New accounts start quiet: everything lands in the in-app inbox, and only
 * the alerts that need action today also go by email. Admins additionally get
 * overdue payments and system problems by email.
 */
export function defaultPrefs(role: Role): NotificationPrefs {
  const prefs = Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [category, { ...OFF }]),
  ) as NotificationPrefs;
  prefs.stock.email = true;
  if (role === 'admin') {
    prefs.payments.email = true;
    prefs.system.email = true;
  }
  return prefs;
}

/** Fills categories added after the account was created, so old documents never break. */
export function resolvePrefs(stored: Partial<NotificationPrefs> | undefined, role: Role) {
  const defaults = defaultPrefs(role);
  return Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category: NotificationCategory) => [
      category,
      { ...defaults[category], ...(stored?.[category] ?? {}) },
    ]),
  ) as NotificationPrefs;
}
