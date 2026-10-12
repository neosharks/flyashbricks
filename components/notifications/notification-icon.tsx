import {
  AlertOctagon,
  Boxes,
  CircleCheck,
  HandCoins,
  Package,
  ReceiptIndianRupee,
  ReceiptText,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import type { NotificationSeverity, NotificationType } from '@/models/constants';
import { cn } from '@/lib/utils';

const ICONS: Record<NotificationType, LucideIcon> = {
  material_low: Package,
  bricks_low: Boxes,
  sale_created: ReceiptIndianRupee,
  sale_voided: ReceiptText,
  payment_received: CircleCheck,
  payments_overdue: HandCoins,
  employee_added: UserPlus,
  backup_failed: AlertOctagon,
};

const TONES: Record<NotificationSeverity, string> = {
  info: 'bg-action-subtle text-action',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  critical: 'bg-danger-subtle text-danger',
};

/** The icon says what it is about; the tint says how urgent. Text carries the meaning. */
export function NotificationIcon({
  type,
  severity,
  className,
}: {
  type: NotificationType;
  severity: NotificationSeverity;
  className?: string;
}) {
  const Icon = ICONS[type];
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full',
        TONES[severity],
        className,
      )}
    >
      <Icon aria-hidden className="size-4" />
    </span>
  );
}
