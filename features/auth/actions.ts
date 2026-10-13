'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthError, CredentialsSignin } from 'next-auth';
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
import {
  DEVICE_COOKIE_NAME,
  DEVICE_COOKIE_OPTIONS,
  LOCALE_COOKIE_NAME,
  PIN_OFFER_COOKIE_NAME,
  useSecureCookies,
} from '@/lib/cookies';
import { User } from '@/models/user';
import {
  enrolDevicePin as enrol,
  hashDeviceToken,
  removeDevicePin as remove,
  revokeDevicePins,
} from './device-pin';
import {
  ChangePasswordSchema,
  CredentialsSchema,
  DeviceIdSchema,
  EnrolPinSchema,
  LocaleSchema,
  PinSignInSchema,
} from './schema';

type CookieJar = Awaited<ReturnType<typeof cookies>>;

/** Set with the same attributes it was written with, or a `__Secure-` cookie is not replaced. */
function clearCookie(jar: CookieJar, name: string): void {
  jar.set(name, '', { ...DEVICE_COOKIE_OPTIONS, maxAge: 0 });
}

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

    // Lets the dashboard offer a PIN for this device once, right after the password.
    (await cookies()).set(PIN_OFFER_COOKIE_NAME, '1', {
      ...DEVICE_COOKIE_OPTIONS,
      maxAge: 60 * 60,
    });
    return ok({ callbackUrl });
  });
}

/** Quick sign-in with this device's PIN; the device itself is named by its cookie. */
export async function signInWithPin(
  _prev: ActionResult<{ callbackUrl: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ callbackUrl: string }>> {
  const raw = formDataToObject(formData);
  const callbackUrl = safeAppPath(raw.callbackUrl);

  return runAction('auth.signInWithPin', async () => {
    const parsed = parseOrFail(PinSignInSchema, { pin: raw.pin });
    if (!parsed.ok) return parsed.result;

    const jar = await cookies();
    const token = jar.get(DEVICE_COOKIE_NAME)?.value;
    if (!token) return fail('PIN_UNAVAILABLE', 'No PIN on this device');

    // Per address and per device. The credential's own lifetime limit stops a
    // slow guesser; these stop a fast one.
    const { ip } = await requestInfo();
    for (const key of [`ip:${ip ?? 'unknown'}`, `device:${hashDeviceToken(token)}`]) {
      const limited = await rateLimit('login', key);
      if (!limited.success) throw new RateLimitError(limited.resetSeconds);
    }

    try {
      await signIn('pin', { pin: parsed.data.pin, redirect: false });
    } catch (err) {
      if (err instanceof CredentialsSignin && err.code !== 'bad_pin') {
        // The PIN is gone — too many wrong tries, or it was revoked — so the
        // cookie is useless and the sign-in page goes back to the password.
        clearCookie(jar, DEVICE_COOKIE_NAME);
        return err.code === 'pin_locked'
          ? fail('PIN_LOCKED', 'Too many wrong PINs')
          : fail('PIN_UNAVAILABLE', 'No PIN on this device');
      }
      if (err instanceof AuthError) {
        return fail('WRONG_PIN', 'Wrong PIN', { fields: { pin: ['wrongPin'] } });
      }
      throw err;
    }

    return ok({ callbackUrl });
  });
}

/** Sets (or replaces) the signed-in person's PIN for this device. */
export async function enrolDevicePin(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('auth.enrolPin', async () => {
    const actor = await requireUser();

    const parsed = parseOrFail(EnrolPinSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    const limited = await rateLimit('pinEnrol', actor.id);
    if (!limited.success) throw new RateLimitError(limited.resetSeconds);

    const jar = await cookies();
    const { userAgent } = await requestInfo();
    const { token, label } = await enrol(
      actor,
      parsed.data.pin,
      jar.get(DEVICE_COOKIE_NAME)?.value ?? null,
      userAgent,
    );
    jar.set(DEVICE_COOKIE_NAME, token, DEVICE_COOKIE_OPTIONS);
    clearCookie(jar, PIN_OFFER_COOKIE_NAME);

    await recordAudit({
      actor,
      action: 'user.pin_enrol',
      entity: 'User',
      entityId: actor.id,
      changes: { device: label },
    });
    revalidatePath('/account');
    return ok();
  });
}

/** Removes one of the person's own PINs; removing this device's also forgets its cookie. */
export async function removeDevicePin(id: string): Promise<ActionResult> {
  return runAction('auth.removePin', async () => {
    const actor = await requireUser();

    const parsed = parseOrFail(DeviceIdSchema, { id });
    if (!parsed.ok) return parsed.result;

    const jar = await cookies();
    const result = await remove(actor, parsed.data.id, jar.get(DEVICE_COOKIE_NAME)?.value ?? null);
    if (!result.removed) return fail('NOT_FOUND', 'Device not found');
    if (result.current) clearCookie(jar, DEVICE_COOKIE_NAME);

    await recordAudit({
      actor,
      action: 'user.pin_remove',
      entity: 'User',
      entityId: actor.id,
    });
    revalidatePath('/account');
    return ok();
  });
}

/** "Not now" on the dashboard's PIN offer. */
export async function dismissPinOffer(): Promise<ActionResult> {
  return runAction('auth.dismissPinOffer', async () => {
    clearCookie(await cookies(), PIN_OFFER_COOKIE_NAME);
    return ok();
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
    await revokeDevicePins(user.orgId, user.id);
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
    // A PIN set under the old password must not outlive it.
    await revokeDevicePins(user.orgId, user._id);

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
