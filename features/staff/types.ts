import type {
  AttendanceStatus,
  PaymentMode,
  StaffPaymentType,
  Gender,
  StaffRole,
  WageType,
} from '@/models/constants';
import type { AttendanceCounts, PaymentTotals } from './wages';

export type StaffRow = {
  id: string;
  name: string;
  nameHi: string | null;
  role: StaffRole;
  title: string | null;
  phone: string | null;
  wageType: WageType;
  wageRatePaise: number;
  overtimeRatePaise: number | null;
  joinedOn: string | null;
  leftOn: string | null;
  isActive: boolean;
  userId: string | null;
  photoAssetId: string | null;
  gender: Gender;
  avatarVariant: number;
  address: string | null;
  notes: string | null;
  createdAt: string;
};

/** A list row with the facts the list shows beside the record itself. */
export type StaffListRow = StaffRow & {
  todayStatus: AttendanceStatus | null;
  balancePaise: number;
};

export type SheetRow = {
  id: string;
  name: string;
  nameHi: string | null;
  role: StaffRole;
  wageType: WageType;
  photoAssetId: string | null;
  gender: Gender;
  avatarVariant: number;
  isActive: boolean;
  status: AttendanceStatus | null;
  overtimeMinutes: number;
  bricks: number;
};

export type StaffPaymentRow = {
  id: string;
  type: StaffPaymentType;
  amountPaise: number;
  mode: PaymentMode;
  paidOn: string;
  periodFrom: string | null;
  periodTo: string | null;
  note: string | null;
  voided: boolean;
  voidReason: string | null;
  recordedByName: string;
};

export type DayMark = {
  day: string;
  status: AttendanceStatus;
  overtimeMinutes: number;
  bricks: number;
};

/** One worker's figures for a stretch of days. */
export type StaffPeriodSummary = {
  counts: AttendanceCounts;
  earnedPaise: number;
  payments: PaymentTotals;
  /** earned + bonus − wages − advances − deductions, within the period. */
  balancePaise: number;
};

export type PayrollRow = StaffPeriodSummary & {
  id: string;
  name: string;
  nameHi: string | null;
  role: StaffRole;
  wageType: WageType;
  wageRatePaise: number;
  isActive: boolean;
};

export const STAFF_SORTS = ['name', 'role', 'createdAt'] as const;
export type StaffSort = (typeof STAFF_SORTS)[number];

export const STAFF_GROUPS = ['role', 'wageType'] as const;
export type StaffGroup = (typeof STAFF_GROUPS)[number];
