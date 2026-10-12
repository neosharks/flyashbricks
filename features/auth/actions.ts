'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { connectDb } from '@/lib/db';
import { runAction, parseOrFail, formDataToObject } from '@/lib/action';
import { ok, fail, type ActionResult } from '@/lib/result';
import { RateLimitError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { hashPassword, verifyPassword } from '@/lib/password';
import { signIn, signOut } from '@/lib/auth';
import { getSessionUser, requireUser } from '@/lib/session';
import { logger } from '@/lib/logger';
import { recordAudit } from '@/lib/audit';
import { requestInfo } from '@/lib/request-info';
import { normalizePhone } from '@/lib/phone';
import { safeAppPath } from '@/lib/safe-path';
import { LOCALE_COOKIE_NAME, useSecureCookies } from '@/lib/cookies';
import { User } from '@/models/user';
import { ChangePasswordSchema, CredentialsSchema, LocaleSchema } from './schema';

export async function signInWithCredentials(
  _prev: ActionResult<{ callbackUrl: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ callbackUrl: string }>> {
  const raw = formDataToObject(formData);
  const callbackUrl = safeAppPath(raw.callbackUrl);

  return runAction('auth.signIn', async () => {
    const parsed = parseOrFail(CredentialsSchema, {
      identifier: raw.identifier,
      password: raw.password,
    });
    if (!parsed.ok) return fail('INVALID_CREDENTIALS', 'Invalid credentials');

    // Limited per address and per account, so neither one host nor one target
    // can be hammered.
    const identifier = parsed.data.identifier.includes('@')
      ? parsed.data.identifier.toLowerCase()
      : (normalizePhone(parsed.data.identifier) ?? parsed.data.identifier);
    const { ip } = await requestInfo();
    for (const key of [`ip:${ip ?? 'unknown'}`, `id:${identifier}`]) {
      const limited = await rateLimit('login', key);
      if (!limited.success) throw new RateLimitError(limited.resetSeconds);
    }

    try {
      await signIn('credentials', { ...parsed.data, redirect: false });
    } catch (err) {
      if (err instanceof AuthError) return fail('INVALID_CREDENTIALS', 'Invalid credentials');
      throw err;
    }

    return ok({ callbackUrl });
  });
}

/**
 * Ends every session this person has — a lost phone, a shared computer —
 * then signs this device out too.
 */
export async function signOutEverywhere(): Promise<void> {
  const user = await getSessionUser();
  if (user) {
    await connectDb();
    await User.updateOne({ _id: user.id }, { $set: { sessionsValidFrom: new Date() } });
    logger.info({ event: 'auth.sign_out_everywhere' }, 'signed out on all devices');
  }
  await signOut({ redirect: false });
  redirect('/login');
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect('/login');
}

/**
 * Changes the signed-in user's own password. Also the way out of a temporary
 * password, which is why it is the one action that accepts one.
 */
export async function changePassword(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('auth.changePassword', async () => {
    const actor = await requireUser({ allowTemporaryPassword: true });

    const parsed = parseOrFail(ChangePasswordSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    const limited = await rateLimit('passwordChange', actor.id);
    if (!limited.success) throw new RateLimitError(limited.resetSeconds);

    await connectDb();
    const user = await User.findById(actor.id).select('+passwordHash').lean();
    if (!user) return fail('UNAUTHORIZED', 'Not signed in');

    if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      return fail('WRONG_PASSWORD', 'Wrong password', {
        fields: { currentPassword: ['wrongPassword'] },
      });
    }

    const now = new Date();
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: await hashPassword(parsed.data.newPassword),
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
          // Every token issued before now stops working, so a session stolen
          // under the old password does not survive the change.
          sessionsValidFrom: now,
        },
      },
    );

    // Re-issue this device's token so the person who just changed it stays in.
    await signIn('credentials', {
      identifier: user.phone,
      password: parsed.data.newPassword,
      redirect: false,
    });

    await recordAudit({
      actor,
      action: 'user.password_change',
      entity: 'User',
      entityId: actor.id,
    });
    logger.info({ event: 'auth.password_change' }, 'password changed');

    return ok();
  });
}

export async function setLocale(locale: string): Promise<ActionResult> {
  return runAction('auth.setLocale', async () => {
    const parsed = parseOrFail(LocaleSchema, { locale });
    if (!parsed.ok) return parsed.result;

    (await cookies()).set(LOCALE_COOKIE_NAME, parsed.data.locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: useSecureCookies,
      httpOnly: true,
    });

    // Email and SMS cannot read the cookie, so the choice is also kept on the account.
    const user = await getSessionUser();
    if (user) {
      await connectDb();
      await User.updateOne({ _id: user.id }, { $set: { locale: parsed.data.locale } });
    }
    return ok();
  });
}
