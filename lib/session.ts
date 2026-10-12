import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from './auth';
import { can, type Action, type Resource, type SessionUser } from './permissions';
import { ForbiddenError, UnauthorizedError } from './errors';
import { forbidden } from './forbidden';

/**
 * Deduped per render pass: a page and the components inside it all read the
 * same session without issuing repeated database queries.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId) return null;

  return {
    id: user.id,
    orgId: user.orgId,
    name: user.name ?? '',
    role: user.role,
    permissions: user.permissions,
    mustChangePassword: user.mustChangePassword,
    avatarAssetId: user.avatarAssetId,
    gender: user.gender,
    avatarVariant: user.avatarVariant,
  };
});

class PasswordChangeRequiredError extends ForbiddenError {
  constructor() {
    super('Set a new password before continuing');
  }
}

/**
 * For Server Actions and Route Handlers: throws rather than redirecting.
 * A temporary password only unlocks setting a real one.
 */
export async function requireUser(options?: { allowTemporaryPassword?: boolean }) {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  if (user.mustChangePassword && !options?.allowTemporaryPassword) {
    throw new PasswordChangeRequiredError();
  }
  return user;
}

export async function requirePermission(action: Action, resource?: Resource) {
  const user = await requireUser();
  if (!can(user, action, resource)) throw new ForbiddenError();
  return user;
}

/** For pages: sends the visitor to sign in and back again. */
export async function requireUserPage(returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(returnTo)}`);
  if (user.mustChangePassword) redirect('/set-password');
  return user;
}

export async function requirePermissionPage(returnTo: string, action: Action) {
  const user = await requireUserPage(returnTo);
  if (!can(user, action)) forbidden();
  return user;
}
