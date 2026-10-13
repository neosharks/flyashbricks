import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { Types, type ObjectId } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { pickText } from '@/lib/bilingual';
import { dateToIso, idToString } from '@/lib/dto';
import { AppError, UnauthorizedError } from '@/lib/errors';
import { hashPassword, verifyPassword } from '@/lib/password';
import type { SessionUser } from '@/lib/permissions';
import { DeviceCredential } from '@/models/device-credential';
import { User, type UserDoc } from '@/models/user';
import { recordLogin } from './login-events';
import type { DevicePinRow } from './types';

/** Wrong PINs in a row before the PIN is deleted and the password is needed again. */
export const MAX_PIN_ATTEMPTS = 5;

/** A PIN nobody has used for this long is deleted by MongoDB's TTL monitor. */
const UNUSED_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

export type PinSignInResult =
  | { ok: true; user: { id: string; name: string } }
  | { ok: false; reason: 'unknown_device' | 'bad_pin' | 'pin_locked' };

export class PinNotAllowedError extends AppError {
  constructor() {
    super('PIN_NOT_ALLOWED', 'Quick sign-in is turned off for this person', 403);
  }
}

/** The device cookie is a bearer secret; only this one-way hash is stored or compared. */
export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function expiry(from: Date): Date {
  return new Date(from.getTime() + UNUSED_LIFETIME_MS);
}

const BROWSERS: [RegExp, string][] = [
  [/Edg(A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  [/Android/, 'Android'],
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/CrOS/, 'ChromeOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'Mac'],
  [/Linux/, 'Linux'],
];

/** "Chrome · Android": enough to tell one's devices apart, without storing the full agent. */
export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return '';
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  return [browser, system].filter(Boolean).join(' · ');
}

/**
 * Whether this person may still use a PIN made at `createdAt`. A PIN made
 * before a password change or a forced sign-out is refused even if deleting
 * it failed at the time.
 */
function usable(
  user: Pick<
    UserDoc,
    'disabledAt' | 'pinSignInAllowed' | 'mustChangePassword' | 'sessionsValidFrom'
  > | null,
  createdAt: Date,
): boolean {
  if (!user || user.disabledAt || !user.pinSignInAllowed || user.mustChangePassword) return false;
  return !user.sessionsValidFrom || createdAt.getTime() >= user.sessionsValidFrom.getTime();
}

const USER_FIELDS =
  'orgId name nameHi disabledAt pinSignInAllowed mustChangePassword sessionsValidFrom';

/**
 * Sets a PIN for `actor` on this device and returns the new device token for
 * the cookie. Whatever PIN this device held before — anyone's — is replaced:
 * the device has one cookie, so it can only ever use one.
 */
export async function enrolDevicePin(
  actor: SessionUser,
  pin: string,
  currentToken: string | null,
  userAgent: string | null,
): Promise<{ token: string; label: string }> {
  await connectDb();
  const user = await User.findOne({ _id: actor.id, orgId: actor.orgId })
    .select('disabledAt pinSignInAllowed')
    .lean();
  if (!user || user.disabledAt) throw new UnauthorizedError();
  if (!user.pinSignInAllowed) throw new PinNotAllowedError();

  if (currentToken) await DeviceCredential.deleteOne({ tokenHash: hashDeviceToken(currentToken) });

  const token = randomBytes(32).toString('base64url');
  const label = deviceLabel(userAgent);
  await DeviceCredential.create({
    orgId: new Types.ObjectId(actor.orgId),
    userId: new Types.ObjectId(actor.id),
    tokenHash: hashDeviceToken(token),
    pinHash: await hashPassword(pin),
    label,
    expiresAt: expiry(new Date()),
  });
  return { token, label };
}

/**
 * Checks a PIN against the credential this device's token points to. The
 * caller has already rate-limited the request; this enforces the lifetime
 * limit of wrong guesses on the credential itself.
 */
export async function verifyDevicePin(token: string | null, pin: string): Promise<PinSignInResult> {
  if (!token) return { ok: false, reason: 'unknown_device' };
  await connectDb();
  const tokenHash = hashDeviceToken(token);

  // The attempt is counted before the PIN is compared, so guesses sent in
  // parallel cannot all be checked against the same, not-yet-incremented count.
  const credential = await DeviceCredential.findOneAndUpdate(
    { tokenHash, failedAttempts: { $lt: MAX_PIN_ATTEMPTS } },
    { $inc: { failedAttempts: 1 } },
    { returnDocument: 'after' },
  )
    .select('+pinHash')
    .lean();
  if (!credential) {
    await DeviceCredential.deleteOne({ tokenHash });
    return { ok: false, reason: 'unknown_device' };
  }

  const user = await User.findOne({ _id: credential.userId, orgId: credential.orgId })
    .select(USER_FIELDS)
    .lean();
  if (!user || !usable(user, credential.createdAt)) {
    await DeviceCredential.deleteOne({ _id: credential._id });
    if (user) await recordLogin(user, false, user.disabledAt ? 'disabled' : 'pin_revoked', 'pin');
    return { ok: false, reason: 'unknown_device' };
  }

  if (!(await verifyPassword(pin, credential.pinHash))) {
    if (credential.failedAttempts >= MAX_PIN_ATTEMPTS) {
      await DeviceCredential.deleteOne({ _id: credential._id });
      await recordLogin(user, false, 'pin_locked', 'pin');
      return { ok: false, reason: 'pin_locked' };
    }
    await recordLogin(user, false, 'bad_pin', 'pin');
    return { ok: false, reason: 'bad_pin' };
  }

  const now = new Date();
  await DeviceCredential.updateOne(
    { _id: credential._id },
    { $set: { failedAttempts: 0, lastUsedAt: now, expiresAt: expiry(now) } },
  );
  await recordLogin(user, true, null, 'pin');
  return { ok: true, user: { id: user._id.toString(), name: user.name } };
}

/**
 * The first name for "Welcome back" on the sign-in page, or null when this
 * device has no usable PIN. Nothing else about the account is read.
 */
export async function devicePinGreeting(
  token: string | null,
  locale: 'en' | 'hi',
): Promise<string | null> {
  if (!token) return null;
  await connectDb();
  const credential = await DeviceCredential.findOne({
    tokenHash: hashDeviceToken(token),
    failedAttempts: { $lt: MAX_PIN_ATTEMPTS },
  }).lean();
  if (!credential) return null;
  const user = await User.findOne({ _id: credential.userId, orgId: credential.orgId })
    .select(USER_FIELDS)
    .lean();
  if (!user || !usable(user, credential.createdAt)) return null;
  const name = pickText(user.name, user.nameHi, locale);
  return name.split(/\s+/)[0] ?? name;
}

export async function isPinSignInAllowed(viewer: SessionUser): Promise<boolean> {
  await connectDb();
  const user = await User.findOne({ _id: viewer.id, orgId: viewer.orgId })
    .select('pinSignInAllowed')
    .lean();
  return user?.pinSignInAllowed === true;
}

/** Whether to offer a PIN to `viewer` on this device: allowed, and not set up here yet. */
export async function shouldOfferDevicePin(
  viewer: SessionUser,
  token: string | null,
): Promise<boolean> {
  if (!(await isPinSignInAllowed(viewer))) return false;
  if (!token) return true;
  const here = await DeviceCredential.exists({
    tokenHash: hashDeviceToken(token),
    userId: viewer.id,
    orgId: viewer.orgId,
  });
  return here === null;
}

/** Ends quick sign-in on every device: password changes, forced sign-outs, disabling. */
export async function revokeDevicePins(
  orgId: ObjectId | string,
  userId: ObjectId | string,
): Promise<number> {
  await connectDb();
  const { deletedCount } = await DeviceCredential.deleteMany({ orgId, userId });
  return deletedCount;
}

export async function listDevicePins(
  viewer: SessionUser,
  token: string | null,
): Promise<DevicePinRow[]> {
  await connectDb();
  const currentHash = token ? hashDeviceToken(token) : null;
  const rows = await DeviceCredential.find({ orgId: viewer.orgId, userId: viewer.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return rows.map((row) => ({
    id: idToString(row._id),
    label: row.label,
    createdAt: dateToIso(row.createdAt),
    lastUsedAt: row.lastUsedAt ? dateToIso(row.lastUsedAt) : null,
    current: row.tokenHash === currentHash,
  }));
}

/** Removes one of the viewer's own PINs; says whether it was this device's. */
export async function removeDevicePin(
  viewer: SessionUser,
  id: string,
  token: string | null,
): Promise<{ removed: boolean; current: boolean }> {
  await connectDb();
  const credential = await DeviceCredential.findOneAndDelete({
    _id: id,
    orgId: viewer.orgId,
    userId: viewer.id,
  }).lean();
  if (!credential) return { removed: false, current: false };
  return {
    removed: true,
    current: token !== null && credential.tokenHash === hashDeviceToken(token),
  };
}
