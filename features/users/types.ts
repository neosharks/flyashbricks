import type { Gender } from '@/models/constants';
import type { Permissions, Role } from '@/lib/permissions';

export type UserRow = {
  id: string;
  /** In the reader's language; both scripts follow for the edit form. */
  name: string;
  nameEn: string;
  nameHi: string | null;
  phone: string;
  email: string | null;
  jobTitle: string | null;
  role: Role;
  permissions: Permissions;
  mustChangePassword: boolean;
  pinSignInAllowed: boolean;
  disabled: boolean;
  lastLoginAt: string | null;
  avatarAssetId: string | null;
  gender: Gender;
  /** Which cartoon picture stands in when there is no photo. */
  avatarVariant: number;
  createdAt: string;
};

export type LoginEventRow = {
  id: string;
  success: boolean;
  method: 'password' | 'pin';
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type ActivityRow = {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: string;
  changes: Record<string, unknown> | null;
  createdAt: string;
};
