import type { Action } from '@/lib/permissions';
import type {
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
} from '@/models/constants';

type TypeMeta = {
  category: NotificationCategory;
  severity: NotificationSeverity;
  /** Who receives it: everyone in the organisation allowed to do this. */
  audience: Action;
};

/**
 * Every notification type, its category (what people set preferences by),
 * how loud it is, and who it goes to. A type missing here does not compile.
 */
export const NOTIFICATION_TYPE_META: Record<NotificationType, TypeMeta> = {
  material_low: { category: 'stock', severity: 'warning', audience: 'rawMaterials:read' },
  bricks_low: { category: 'stock', severity: 'warning', audience: 'production:read' },
  sale_created: { category: 'sales', severity: 'info', audience: 'sales:read' },
  sale_voided: { category: 'sales', severity: 'warning', audience: 'sales:read' },
  payment_received: { category: 'payments', severity: 'success', audience: 'sales:read' },
  payments_overdue: { category: 'payments', severity: 'warning', audience: 'sales:read' },
  employee_added: { category: 'team', severity: 'info', audience: 'users:read' },
  backup_failed: { category: 'system', severity: 'critical', audience: 'backup:run' },
};
