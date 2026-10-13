import { User } from '@/models/user';
import { LoginEvent } from '@/models/login-event';
import { AuditLog } from '@/models/audit-log';
import { RawMaterial } from '@/models/raw-material';
import { MaterialMovement } from '@/models/material-movement';
import { Product } from '@/models/product';
import { ProductionEntry } from '@/models/production-entry';
import { StockMovement } from '@/models/stock-movement';
import { Customer } from '@/models/customer';
import { Sale } from '@/models/sale';
import { Notification } from '@/models/notification';
import { Asset } from '@/models/asset';
import { StaffMember } from '@/models/staff-member';
import { Attendance } from '@/models/attendance';
import { StaffPayment } from '@/models/staff-payment';

/**
 * Every organisation-scoped collection a backup holds, in restore order.
 * Adding a collection to the app means adding it here, or it is silently left
 * out of every backup — the export test lists these names to catch that.
 *
 * Read and written through the native driver collections, so documents go
 * out and come back byte-for-byte, without Mongoose casting or `select: false`.
 *
 * Deliberately excluded: the outbox (transient delivery queue), quick-sign-in
 * PINs (bound to one browser's cookie, and a restore must not revive them) and
 * other organisations' data. Counters are handled separately: their `_id` carries
 * the organisation id rather than an `orgId` field.
 */
export const BACKUP_COLLECTIONS = {
  users: User,
  rawMaterials: RawMaterial,
  products: Product,
  customers: Customer,
  materialMovements: MaterialMovement,
  productionEntries: ProductionEntry,
  stockMovements: StockMovement,
  sales: Sale,
  auditLogs: AuditLog,
  loginEvents: LoginEvent,
  notifications: Notification,
  // Photo records only; the image files live in the storage volume (see docs/backup.md).
  assets: Asset,
  staffMembers: StaffMember,
  attendance: Attendance,
  staffPayments: StaffPayment,
} as const;

export type BackupCollectionName = keyof typeof BACKUP_COLLECTIONS | 'counters';

export const BACKUP_FORMAT = 'fly-ash-bricks-backup';
export const BACKUP_VERSION = 1;
