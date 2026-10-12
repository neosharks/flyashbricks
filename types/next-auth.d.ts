import type { DefaultSession } from 'next-auth';
import type { Permissions, Role } from '@/lib/permissions';
import type { Gender } from '@/models/constants';

declare module 'next-auth' {
  interface Session {
    /** Everything but `id` is read from the database on every request. */
    user: {
      id: string;
      orgId: string;
      role: Role;
      permissions: Permissions;
      mustChangePassword: boolean;
      avatarAssetId: string | null;
      gender: Gender;
      avatarVariant: number;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
    /** Epoch milliseconds at issue, checked against `user.sessionsValidFrom`. */
    issuedAt?: number;
  }
}
