import 'server-only';
import NextAuth, { CredentialsSignin, type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { Types, type ObjectId } from '@/lib/mongoose';
import { connectDb } from './db';
import { verifyPassword, burnTimingBudget } from './password';
import { logger } from './logger';
import { env } from './env';
import { rateLimit } from './rate-limit';
import { normalizePhone } from './phone';
import { requestInfo } from './request-info';
import { SESSION_COOKIE_NAME, useSecureCookies } from './cookies';
import { NO_ACCESS } from './permissions';
import { User } from '@/models/user';
import { LoginEvent } from '@/models/login-event';
import { CredentialsSchema } from '@/features/auth/schema';

class InvalidCredentials extends CredentialsSignin {
  override code = 'invalid_credentials';
}

function identifierFilter(identifier: string): { email: string } | { phone: string } | null {
  if (identifier.includes('@')) return { email: identifier.toLowerCase() };
  const phone = normalizePhone(identifier);
  return phone ? { phone } : null;
}

async function recordLogin(
  user: { _id: ObjectId; orgId: ObjectId },
  success: boolean,
  reason: string | null,
): Promise<void> {
  try {
    const { ip, userAgent } = await requestInfo();
    await LoginEvent.create({
      orgId: user.orgId,
      userId: user._id,
      success,
      reason,
      ip,
      userAgent,
    });
    if (success) await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  } catch (err) {
    // A failed history write must not lock someone out of their account.
    logger.error({ err }, 'failed to record login event');
  }
}

const config: NextAuthConfig = {
  // The Credentials provider requires the JWT strategy. Revocation and role
  // changes stay immediate because the session callback re-reads the user on
  // every request — see docs/adr/0002-authentication.md.
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 14, updateAge: 60 * 60 },
  // Only behind a proxy that sets the Host header (the tunnel); AUTH_URL pins it otherwise.
  trustHost: env.AUTH_TRUST_HOST,
  pages: { signIn: '/login', error: '/login' },
  cookies: {
    sessionToken: {
      name: SESSION_COOKIE_NAME,
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: useSecureCookies },
    },
  },
  providers: [
    Credentials({
      credentials: { identifier: {}, password: {} },
      authorize: async (raw) => {
        // Auth.js hands the whole request body here, including its own csrf and
        // callback fields; the schema is `.strict()`, so pick the two out.
        const parsed = CredentialsSchema.safeParse({
          identifier: raw.identifier,
          password: raw.password,
        });
        if (!parsed.success) throw new InvalidCredentials();

        const filter = identifierFilter(parsed.data.identifier);
        if (!filter) throw new InvalidCredentials();

        // A second, looser limit at the point of the password check itself, so
        // no route to it — present or future — can be used to guess freely.
        const { ip } = await requestInfo();
        const identity = 'email' in filter ? filter.email : filter.phone;
        for (const key of [`ip:${ip ?? 'unknown'}`, `id:${identity}`]) {
          if (!(await rateLimit('loginBackend', key)).success) throw new InvalidCredentials();
        }

        await connectDb();
        const user = await User.findOne(filter).select('+passwordHash').lean();

        // Same error and comparable timing whether or not the account exists.
        if (!user) {
          await burnTimingBudget();
          logger.info({ event: 'auth.login_unknown' }, 'sign-in for unknown identifier');
          throw new InvalidCredentials();
        }

        const valid = await verifyPassword(parsed.data.password, user.passwordHash);
        // Failure records are written in the background: awaiting a database
        // write here would make a real account answer measurably slower than
        // an unknown one, which reveals which phone numbers have accounts.
        if (!valid) {
          void recordLogin(user, false, 'bad_password');
          throw new InvalidCredentials();
        }
        // Checked after the password so the response does not reveal that a
        // guessed account exists but is disabled.
        if (user.disabledAt) {
          void recordLogin(user, false, 'disabled');
          throw new InvalidCredentials();
        }
        // An unused temporary password stops working after a few days.
        if (
          user.mustChangePassword &&
          user.temporaryPasswordExpiresAt &&
          user.temporaryPasswordExpiresAt.getTime() < Date.now()
        ) {
          void recordLogin(user, false, 'expired');
          throw new InvalidCredentials();
        }

        await recordLogin(user, true, null);
        return { id: user._id.toString(), name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user?.id) {
        token.uid = user.id;
        // Stamped at issue so the session callback can refuse tokens that
        // predate a password change or a forced sign-out.
        token.issuedAt = Date.now();
      }
      return token;
    },
    /**
     * Authorization data is read fresh from the database rather than carried in
     * the token, so a disabled account or changed permissions take effect on the
     * next request instead of at token expiry.
     */
    session: async ({ session, token }) => {
      const uid = typeof token.uid === 'string' ? token.uid : null;
      const revoked = {
        ...session,
        user: {
          ...session.user,
          id: '',
          orgId: '',
          role: 'employee' as const,
          permissions: NO_ACCESS,
          mustChangePassword: true,
          avatarAssetId: null,
          gender: 'unspecified' as const,
          avatarVariant: 0,
        },
      };
      if (!uid || !Types.ObjectId.isValid(uid)) return revoked;

      await connectDb();
      const user = await User.findById(uid)
        .select(
          'orgId name role permissions mustChangePassword disabledAt sessionsValidFrom avatarAssetId gender avatarVariant',
        )
        .lean();

      const issuedAt = typeof token.issuedAt === 'number' ? token.issuedAt : 0;
      const staleToken = user?.sessionsValidFrom
        ? issuedAt < user.sessionsValidFrom.getTime()
        : false;

      // `getSessionUser` treats an empty id as signed out.
      if (!user || user.disabledAt || staleToken) return revoked;

      return {
        ...session,
        user: {
          ...session.user,
          id: user._id.toString(),
          orgId: user.orgId.toString(),
          name: user.name,
          role: user.role,
          permissions: { ...NO_ACCESS, ...user.permissions },
          mustChangePassword: user.mustChangePassword,
          avatarAssetId: user.avatarAssetId?.toString() ?? null,
          gender: user.gender,
          avatarVariant: user.avatarVariant,
        },
      };
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
