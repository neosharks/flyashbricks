import type { Gender } from '@/models/constants';
/**
 * Access model.
 *
 * Every organisation has one or more admins, who can do everything, and
 * employees, who get an access level per module. The modules are the
 * business verticals; `none < read < write`.
 */
export const ROLES = ['admin', 'employee'] as const;
export type Role = (typeof ROLES)[number];

export const MODULES = ['rawMaterials', 'production', 'sales', 'staff', 'users'] as const;
export type Module = (typeof MODULES)[number];

export const ACCESS_LEVELS = ['none', 'read', 'write'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export type Permissions = Record<Module, AccessLevel>;

export const NO_ACCESS: Permissions = {
  rawMaterials: 'none',
  production: 'none',
  sales: 'none',
  staff: 'none',
  users: 'none',
};

export type SessionUser = {
  id: string;
  orgId: string;
  name: string;
  role: Role;
  permissions: Permissions;
  /** A temporary password is still in place; everything except setting one is refused. */
  mustChangePassword: boolean;
  /** Profile photo, for the header. Not an authorization fact. */
  avatarAssetId?: string | null | undefined;
  gender?: Gender | undefined;
  avatarVariant?: number | undefined;
};

const RANK: Record<AccessLevel, number> = { none: 0, read: 1, write: 2 };

export function hasAccess(user: SessionUser, module: Module, level: Exclude<AccessLevel, 'none'>) {
  if (user.role === 'admin') return true;
  return RANK[user.permissions[module]] >= RANK[level];
}

export type Action =
  | 'rawMaterials:read'
  | 'rawMaterials:write'
  | 'production:read'
  | 'production:write'
  | 'sales:read'
  | 'sales:write'
  | 'sales:void'
  | 'staff:read'
  | 'staff:write'
  | 'users:read'
  | 'users:write'
  | 'activity:read'
  | 'backup:run'
  | 'settings:manage';

/** Only the facts an authorization decision may depend on. */
export type Resource = {
  orgId?: string;
  /** The role of the user being managed, for `users:write`. */
  targetRole?: Role;
};

/**
 * The single authorization decision point. Deny by default: an action with no
 * explicit case returns false, so a new action is locked until a rule is written.
 *
 * A resource from another organisation is always refused, even for an admin —
 * queries are scoped by organisation already, and this is the second lock.
 */
export function can(user: SessionUser, action: Action, resource?: Resource): boolean {
  if (resource?.orgId !== undefined && resource.orgId !== user.orgId) return false;

  switch (action) {
    case 'rawMaterials:read':
      return hasAccess(user, 'rawMaterials', 'read');
    case 'rawMaterials:write':
      return hasAccess(user, 'rawMaterials', 'write');
    case 'production:read':
      return hasAccess(user, 'production', 'read');
    case 'production:write':
      return hasAccess(user, 'production', 'write');
    case 'sales:read':
      return hasAccess(user, 'sales', 'read');
    case 'sales:write':
      return hasAccess(user, 'sales', 'write');
    // Voiding rewrites money and stock history, so it is an admin decision.
    case 'sales:void':
      return user.role === 'admin';
    case 'staff:read':
      return hasAccess(user, 'staff', 'read');
    // Attendance, wages and payments to workers.
    case 'staff:write':
      return hasAccess(user, 'staff', 'write');
    case 'users:read':
      return hasAccess(user, 'users', 'read');
    case 'users:write':
      // Only an admin may change another admin's account.
      if (resource?.targetRole === 'admin') return user.role === 'admin';
      return hasAccess(user, 'users', 'write');
    case 'activity:read':
      return user.role === 'admin';
    // A backup holds every record the organisation has, so only admins may take one.
    case 'backup:run':
      return user.role === 'admin';
    // Company details printed on every invoice, and the GST rate.
    case 'settings:manage':
      return user.role === 'admin';
    default:
      return false;
  }
}

/**
 * An employee who manages users may hand out at most the access they hold
 * themselves, so `users:write` can never be used to escalate privileges.
 */
export function canGrant(actor: SessionUser, role: Role, permissions: Permissions): boolean {
  if (actor.role === 'admin') return true;
  if (role === 'admin') return false;
  return MODULES.every((module) => RANK[permissions[module]] <= RANK[actor.permissions[module]]);
}

/**
 * Whether `actor` may change another login (edit, reset password, disable,
 * sign out). Admins may manage anyone in their organisation. An employee with
 * `users:write` may only manage non-admins whose current access is no greater
 * than their own — otherwise resetting a stronger colleague's password would
 * hand the employee that colleague's access.
 */
export function canManageUser(
  actor: SessionUser,
  target: { orgId: string; role: Role; permissions: Permissions },
): boolean {
  return (
    can(actor, 'users:write', { orgId: target.orgId, targetRole: target.role }) &&
    canGrant(actor, target.role, target.permissions)
  );
}
