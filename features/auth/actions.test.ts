// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from '@/lib/mongoose';
import { NO_ACCESS, type SessionUser } from '@/lib/permissions';
import { hashPassword } from '@/lib/password';
import { DEVICE_COOKIE_NAME, PIN_OFFER_COOKIE_NAME } from '@/lib/cookies';
import { clearTestDb, startTestDb, stopTestDb, syncIndexes } from '@/tests/db';
import { aUser } from '@/tests/factories';
import { DeviceCredential } from '@/models/device-credential';
import { User } from '@/models/user';

const mocks = vi.hoisted(() => {
  class AuthError extends Error {}
  class CredentialsSignin extends AuthError {
    code = 'credentials';
  }
  return {
    AuthError,
    CredentialsSignin,
    jar: new Map<string, string>(),
    ip: '',
    viewer: null as SessionUser | null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    recordAudit: vi.fn(),
  };
});

vi.mock('next-auth', () => ({
  AuthError: mocks.AuthError,
  CredentialsSignin: mocks.CredentialsSignin,
}));
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        mocks.jar.has(name) ? { name, value: mocks.jar.get(name) } : undefined,
      has: (name: string) => mocks.jar.has(name),
      set: (name: string, value: string, options?: { maxAge?: number }) => {
        if (options?.maxAge === 0) mocks.jar.delete(name);
        else mocks.jar.set(name, value);
      },
    }),
  headers: () => Promise.resolve(new Headers({ 'x-forwarded-for': mocks.ip })),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next-intl/server', () => ({
  getTranslations: () => Promise.resolve(Object.assign((key: string) => key, { has: () => false })),
}));
vi.mock('@/lib/db', () => ({ connectDb: () => Promise.resolve() }));
vi.mock('@/lib/audit', () => ({ recordAudit: mocks.recordAudit }));
vi.mock('@/lib/auth', () => ({ signIn: mocks.signIn, signOut: mocks.signOut }));
vi.mock('@/lib/session', () => ({
  getSessionUser: () => Promise.resolve(mocks.viewer),
  requireUser: (options?: { allowTemporaryPassword?: boolean }) => {
    const viewer = mocks.viewer;
    if (!viewer || (viewer.mustChangePassword && !options?.allowTemporaryPassword)) {
      return Promise.reject(new Error('not signed in'));
    }
    return Promise.resolve(viewer);
  },
}));

const { verifyDevicePin } = await import('./device-pin');
const {
  changePassword,
  enrolDevicePin,
  removeDevicePin,
  signInWithPin,
  signOutAction,
  signOutEverywhere,
} = await import('./actions');

const ORG = new Types.ObjectId().toString();

beforeAll(async () => {
  await startTestDb();
  await syncIndexes([DeviceCredential]);
}, 180_000);
beforeEach(() => {
  mocks.jar.clear();
  // A fresh address per test, so the in-memory rate limiter never carries over.
  mocks.ip = randomUUID();
  mocks.recordAudit.mockReset();
  mocks.signOut.mockReset();
  // Stands in for Auth.js: the real `pin` provider reads the cookie and asks the same service.
  mocks.signIn.mockReset().mockImplementation(async (provider: string, input: { pin: string }) => {
    if (provider !== 'pin') return;
    const result = await verifyDevicePin(mocks.jar.get(DEVICE_COOKIE_NAME) ?? null, input.pin);
    if (!result.ok) {
      const err = new mocks.CredentialsSignin();
      err.code = result.reason;
      throw err;
    }
  });
});
afterEach(clearTestDb);
afterAll(stopTestDb);

async function signedIn(password = 'old password 123'): Promise<SessionUser> {
  const doc = await aUser(ORG, { role: 'employee' });
  await User.updateOne({ _id: doc._id }, { $set: { passwordHash: await hashPassword(password) } });
  mocks.viewer = {
    id: doc._id.toString(),
    orgId: ORG,
    name: doc.name,
    role: 'employee',
    permissions: NO_ACCESS,
    mustChangePassword: false,
  };
  return mocks.viewer;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const enrol = (pin = '482913') => enrolDevicePin(null, form({ pin, confirmPin: pin }));
const pinSignIn = (pin: string) => signInWithPin(null, form({ pin, callbackUrl: '/sales' }));

describe('enrolDevicePin', () => {
  it('creates the credential, sets the device cookie and records it', async () => {
    const user = await signedIn();
    mocks.jar.set(PIN_OFFER_COOKIE_NAME, '1');

    expect(await enrol()).toEqual({ ok: true, data: undefined });

    const token = mocks.jar.get(DEVICE_COOKIE_NAME);
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(await DeviceCredential.countDocuments({ userId: user.id })).toBe(1);
    expect(mocks.jar.has(PIN_OFFER_COOKIE_NAME)).toBe(false);
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.pin_enrol', entityId: user.id }),
    );
  });

  it('refuses a PIN that is easy to guess or not typed the same twice', async () => {
    await signedIn();
    expect(await enrol('111111')).toMatchObject({
      ok: false,
      fields: { pin: ['pinTooSimple'] },
    });
    expect(await enrolDevicePin(null, form({ pin: '482913', confirmPin: '482914' }))).toMatchObject(
      { ok: false, fields: { confirmPin: ['pinsDoNotMatch'] } },
    );
    expect(await DeviceCredential.countDocuments()).toBe(0);
  });

  it('is refused when PIN sign-in is turned off for the person', async () => {
    const user = await signedIn();
    await User.updateOne({ _id: user.id }, { $set: { pinSignInAllowed: false } });

    expect(await enrol()).toMatchObject({ ok: false, code: 'PIN_NOT_ALLOWED' });
    expect(mocks.jar.has(DEVICE_COOKIE_NAME)).toBe(false);
  });

  it('is refused while the password is still temporary', async () => {
    const user = await signedIn();
    mocks.viewer = { ...user, mustChangePassword: true };

    expect((await enrol()).ok).toBe(false);
    expect(await DeviceCredential.countDocuments()).toBe(0);
  });
});

describe('signInWithPin', () => {
  it('signs in with the right PIN on the enrolled device', async () => {
    await signedIn();
    await enrol();
    mocks.viewer = null;

    expect(await pinSignIn('482913')).toEqual({ ok: true, data: { callbackUrl: '/sales' } });
    expect(mocks.signIn).toHaveBeenCalledWith('pin', { pin: '482913', redirect: false });
  });

  it('says the PIN is wrong, then removes it and the cookie at the fifth try', async () => {
    await signedIn();
    await enrol();

    for (let attempt = 1; attempt < 5; attempt += 1) {
      mocks.ip = randomUUID();
      expect(await pinSignIn('000001')).toMatchObject({
        ok: false,
        code: 'WRONG_PIN',
        fields: { pin: ['wrongPin'] },
      });
    }
    mocks.ip = randomUUID();
    expect(await pinSignIn('000001')).toMatchObject({ ok: false, code: 'PIN_LOCKED' });
    expect(mocks.jar.has(DEVICE_COOKIE_NAME)).toBe(false);
    expect(await DeviceCredential.countDocuments()).toBe(0);
  });

  it('fails without a device cookie, before asking Auth.js', async () => {
    expect(await pinSignIn('482913')).toMatchObject({ ok: false, code: 'PIN_UNAVAILABLE' });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("fails with another person's device cookie and forgets a cookie that matches nothing", async () => {
    await signedIn();
    await enrol('482913');
    const rameshCookie = mocks.jar.get(DEVICE_COOKIE_NAME) ?? '';
    mocks.jar.clear();
    await signedIn();
    await enrol('730264');

    mocks.jar.set(DEVICE_COOKIE_NAME, rameshCookie);
    expect(await pinSignIn('730264')).toMatchObject({ ok: false, code: 'WRONG_PIN' });

    mocks.jar.set(DEVICE_COOKIE_NAME, 'made-up-token');
    expect(await pinSignIn('730264')).toMatchObject({ ok: false, code: 'PIN_UNAVAILABLE' });
    expect(mocks.jar.has(DEVICE_COOKIE_NAME)).toBe(false);
  });

  it('limits attempts from one address across devices', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      mocks.jar.set(DEVICE_COOKIE_NAME, randomUUID());
      expect((await pinSignIn('482913')).ok).toBe(false);
    }
    mocks.jar.set(DEVICE_COOKIE_NAME, randomUUID());
    expect(await pinSignIn('482913')).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
    expect(mocks.signIn).toHaveBeenCalledTimes(5);
  });

  it('limits attempts on one device across addresses', async () => {
    const token = randomUUID();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      mocks.ip = randomUUID();
      mocks.jar.set(DEVICE_COOKIE_NAME, token);
      await pinSignIn('482913');
    }
    mocks.ip = randomUUID();
    mocks.jar.set(DEVICE_COOKIE_NAME, token);
    expect(await pinSignIn('482913')).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
  });
});

describe('ending quick sign-in', () => {
  it('a password change removes every PIN the person has', async () => {
    const user = await signedIn();
    await enrol();
    await DeviceCredential.create({
      orgId: new Types.ObjectId(ORG),
      userId: new Types.ObjectId(user.id),
      tokenHash: 'another-device',
      pinHash: 'x',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await changePassword(
      null,
      form({
        currentPassword: 'old password 123',
        newPassword: 'a brand new sentence',
        confirmPassword: 'a brand new sentence',
      }),
    );

    expect(result.ok).toBe(true);
    expect(await DeviceCredential.countDocuments({ userId: user.id })).toBe(0);
  });

  it('a normal sign-out ends the session but keeps the PIN', async () => {
    const user = await signedIn();
    await enrol();

    await signOutAction();

    expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false });
    expect(await DeviceCredential.countDocuments({ userId: user.id })).toBe(1);
    expect(mocks.jar.has(DEVICE_COOKIE_NAME)).toBe(true);
  });

  it('"sign out everywhere" removes every PIN', async () => {
    const user = await signedIn();
    await enrol();

    await signOutEverywhere();

    expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false });
    expect(await DeviceCredential.countDocuments({ userId: user.id })).toBe(0);
  });

  it('removing this device’s PIN also forgets its cookie', async () => {
    const user = await signedIn();
    await enrol();
    const id = (await DeviceCredential.findOne({ userId: user.id }).lean())?._id.toString() ?? '';

    expect(await removeDevicePin(id)).toEqual({ ok: true, data: undefined });
    expect(mocks.jar.has(DEVICE_COOKIE_NAME)).toBe(false);
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.pin_remove' }),
    );
  });
});
