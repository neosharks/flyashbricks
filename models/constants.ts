/**
 * Single source of truth for every enumerated value. Zod schemas and Mongoose
 * schemas both read from here so they can never drift apart.
 */
export { UNITS, type Unit } from '@/lib/quantity';

/** Drives the icon and colour of a material; the name is free text. */
export const MATERIAL_KINDS = ['fly_ash', 'cement', 'sand', 'lime', 'gypsum', 'other'] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export const MATERIAL_MOVEMENT_TYPES = [
  'purchase',
  'consumption',
  'consumption_reversal',
  'adjustment',
] as const;
export type MaterialMovementType = (typeof MATERIAL_MOVEMENT_TYPES)[number];

export const STOCK_MOVEMENT_TYPES = [
  'production',
  'production_void',
  'sale',
  'sale_void',
  'adjustment',
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_MODES = ['cash', 'upi', 'bank', 'cheque', 'other'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const OUTBOX_STATUSES = ['pending', 'processing', 'done', 'failed'] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export const OUTBOX_TOPICS = ['notification.deliver'] as const;
export type OutboxTopic = (typeof OUTBOX_TOPICS)[number];

/** Recorded for everyone on the platform; chooses their default picture. */
export const GENDERS = ['male', 'female', 'other', 'unspecified'] as const;
export type Gender = (typeof GENDERS)[number];

/** Distinct cartoon pictures per gender (see components/ui/worker-avatar.tsx). */
export const AVATAR_VARIANTS = 100;

/** What a worker does at the plant; drives grouping and default wage type. */
export const STAFF_ROLES = [
  'labour',
  'moulder',
  'machine_operator',
  'loader',
  'driver',
  'supervisor',
  'manager',
  'office',
  'other',
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** How pay is earned: per day present, per month, or per 1,000 bricks made. */
export const WAGE_TYPES = ['daily', 'monthly', 'per_thousand_bricks'] as const;
export type WageType = (typeof WAGE_TYPES)[number];

export const ATTENDANCE_STATUSES = ['present', 'half_day', 'absent', 'leave', 'holiday'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** Money to or from a worker. Wages and bonuses are owed; advances and deductions are taken back. */
export const STAFF_PAYMENT_TYPES = ['wage', 'advance', 'bonus', 'deduction'] as const;
export type StaffPaymentType = (typeof STAFF_PAYMENT_TYPES)[number];

/** Every kind of notification. Labels live under `notifications.types.<type>`. */
export const NOTIFICATION_TYPES = [
  'material_low',
  'bricks_low',
  'sale_created',
  'sale_voided',
  'payment_received',
  'payments_overdue',
  'employee_added',
  'backup_failed',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** What a person chooses channels for; each type belongs to one. */
export const NOTIFICATION_CATEGORIES = ['stock', 'sales', 'payments', 'team', 'system'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Channels besides the in-app inbox, which is always on. */
export const NOTIFICATION_CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_SEVERITIES = ['info', 'success', 'warning', 'critical'] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export const DELIVERY_STATUSES = ['sent', 'failed', 'skipped'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Upper bounds that keep documents far below the 16MB limit and writes cheap. */
export const LIMITS = {
  recipeItems: 12,
  phonesPerCustomer: 5,
  linesPerSale: 20,
  paymentsPerSale: 100,
  /** Largest single entry of bricks — produced, sold or adjusted. */
  bricksPerEntry: 10_000_000,
} as const;
