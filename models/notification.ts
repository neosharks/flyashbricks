import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';
import {
  DELIVERY_STATUSES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_SEVERITIES,
  NOTIFICATION_TYPES,
  type DeliveryStatus,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationSeverity,
  type NotificationType,
} from './constants';

export type NotificationParams = Record<string, string | number>;

export type Delivery = {
  channel: NotificationChannel;
  status: DeliveryStatus;
  at: Date;
  error: string | null;
};

/**
 * One notification for one person. The text is not stored: `type` and
 * `params` are rendered at read time in the reader's language, so the same
 * alert reads in Hindi for one person and English for another.
 *
 * `href` is the in-app path the notification opens — always a relative path,
 * checked when written and again when followed.
 */
export type NotificationDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  userId: ObjectId;
  type: NotificationType;
  category: NotificationCategory;
  severity: NotificationSeverity;
  params: NotificationParams;
  href: string;
  /** Set for notifications that must exist at most once per person (daily digests). */
  dedupeKey: string | null;
  readAt: Date | null;
  deliveries: Delivery[];
  createdAt: Date;
};

const DeliverySchema = new Schema<Delivery>(
  {
    channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
    status: { type: String, enum: DELIVERY_STATUSES, required: true },
    at: { type: Date, required: true },
    error: { type: String, default: null, maxlength: 300 },
  },
  { _id: false },
);

const NotificationSchema = new Schema<NotificationDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    category: { type: String, enum: NOTIFICATION_CATEGORIES, required: true },
    severity: { type: String, enum: NOTIFICATION_SEVERITIES, required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    href: { type: String, required: true, maxlength: 300, match: /^\/(?!\/)/ },
    dedupeKey: { type: String, default: null, maxlength: 120 },
    readAt: { type: Date, default: null },
    deliveries: { type: [DeliverySchema], default: [] },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'notifications',
    strict: 'throw',
    // `params` is a free-form map of display values; empty objects must survive.
    minimize: false,
  },
);

NotificationSchema.index({ orgId: 1, userId: 1, createdAt: -1, _id: -1 });
// The bell's unread count.
NotificationSchema.index({ userId: 1, readAt: 1 });
NotificationSchema.index(
  { userId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export const Notification: Model<NotificationDoc> =
  (models.Notification as Model<NotificationDoc> | undefined) ??
  model<NotificationDoc>('Notification', NotificationSchema);
