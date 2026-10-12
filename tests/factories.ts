import { Types, type ObjectId } from '@/lib/mongoose';
import { NO_ACCESS, type Permissions, type Role } from '@/lib/permissions';
import { defaultPrefs } from '@/features/notifications/prefs';
import { User } from '@/models/user';

let phoneCounter = 0;

/**
 * A user in `orgId`, for tests that depend on who receives notifications.
 * The password hash is a placeholder: these tests never sign in.
 */
export async function aUser(
  orgId: ObjectId | string,
  options: {
    role?: Role;
    permissions?: Partial<Permissions>;
    email?: string | null;
    disabled?: boolean;
  } = {},
) {
  phoneCounter += 1;
  const role = options.role ?? 'admin';
  return User.create({
    orgId: new Types.ObjectId(orgId),
    name: `Test user ${phoneCounter}`,
    phone: `9${String(100_000_000 + phoneCounter).slice(-9)}`,
    email: options.email ?? null,
    passwordHash: 'not-a-real-hash',
    role,
    permissions: { ...NO_ACCESS, ...options.permissions },
    mustChangePassword: false,
    notificationPrefs: defaultPrefs(role),
    disabledAt: options.disabled ? new Date() : null,
  });
}
