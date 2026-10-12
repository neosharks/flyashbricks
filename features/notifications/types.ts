import type {
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
} from '@/models/constants';

/** A notification ready to show: already rendered in the reader's language. */
export type NotificationItem = {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
};
