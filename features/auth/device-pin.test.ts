// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Types } from '@/lib/mongoose';
import { NO_ACCESS, type SessionUser } from '@/lib/permissions';
import { clearTestDb, startTestDb, stopTestDb, syncIndexes } from '@/tests/db';
import { aUser } from '@/tests/factories';
import { DeviceCredential } from '@/models/device-credential';
import { LoginEvent } from '@/models/login-event';
import { User } from '@/models/user';
import {
  MAX_PIN_ATTEMPTS,
  PinNotAllowedError,
  deviceLabel,
  devicePinGreeting,
  enrolDevicePin,
  hashDeviceToken,
  listDevicePins,
  removeDevicePin,
  revokeDevicePins,
  shouldOfferDevicePin,
  verifyDevicePin,
} from './device-pin';

vi.mock('@/lib/db', () => ({ connectDb: () => Promise.resolve() }));

const ORG = new Types.ObjectId().toString();
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36';

beforeAll(async () => {
  await startTestDb();
  await syncIndexes([DeviceCredential]);
}, 180_000);
afterEach(clearTestDb);
afterAll(stopTestDb);

async function person(name = 'Ramesh Kumar'): Promise<SessionUser> {
  const doc = await aUser(ORG, { role: 'employee' });
  await User.updateOne({ _id: doc._id }, { $set: { name, nameHi: 'रमेश कुमार' } });
  return {
    id: doc._id.toString(),
    orgId: ORG,
    name,
    role: 'employee',
    permissions: NO_ACCESS,
    mustChangePassword: false,
  };
}

describe('enrolDevicePin', () => {
  it('stores only hashes and hands back the token for the cookie', async () => {
    const user = await person();
    const { token, label } = await enrolDevicePin(user, '482913', null, ANDROID_CHROME);

    const stored = await DeviceCredential.findOne({ userId: user.id }).select('+pinHash').lean();
    expect(label).toBe('Chrome · Android');
    expect(stored?.tokenHash).toBe(hashDeviceToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored?.pinHash).toMatch(/^\$2[ab]\$12\$/);
    expect(stored?.pinHash).not.toContain('482913');
  });

  it('keeps one PIN per device: setting it again replaces the old one', async () => {
    const user = await person();
    const first = await enrolDevicePin(user, '482913', null, null);
    const second = await enrolDevicePin(user, '730264', first.token, null);

    expect(await DeviceCredential.countDocuments({ userId: user.id })).toBe(1);
    expect(await verifyDevicePin(first.token, '482913')).toEqual({
      ok: false,
      reason: 'unknown_device',
    });
    expect((await verifyDevicePin(second.token, '730264')).ok).toBe(true);
  });

  it('is refused when PIN sign-in is turned off for the person', async () => {
    const user = await person();
    await User.updateOne({ _id: user.id }, { $set: { pinSignInAllowed: false } });

    await expect(enrolDevicePin(user, '482913', null, null)).rejects.toBeInstanceOf(
      PinNotAllowedError,
    );
    expect(await DeviceCredential.countDocuments()).toBe(0);
  });
});

describe('verifyDevicePin', () => {
  it('signs in with the right device and PIN, and records how', async () => {
    const user = await person();
    const { token } = await enrolDevicePin(user, '482913', null, null);

    expect(await verifyDevicePin(token, '482913')).toEqual({
      ok: true,
      user: { id: user.id, name: 'Ramesh Kumar' },
    });
    const credential = await DeviceCredential.findOne({ userId: user.id }).lean();
    expect(credential?.lastUsedAt).toBeInstanceOf(Date);
    expect(credential?.failedAttempts).toBe(0);
    const event = await LoginEvent.findOne({ userId: user.id }).lean();
    expect(event).toMatchObject({ success: true, method: 'pin' });
  });

  it('counts wrong PINs and deletes the PIN at the fifth', async () => {
    const user = await person();
    const { token } = await enrolDevicePin(user, '482913', null, null);

    for (let attempt = 1; attempt < MAX_PIN_ATTEMPTS; attempt += 1) {
      expect(await verifyDevicePin(token, '000001')).toEqual({ ok: false, reason: 'bad_pin' });
      const credential = await DeviceCredential.findOne({ userId: user.id }).lean();
      expect(credential?.failedAttempts).toBe(attempt);
    }

    expect(await verifyDevicePin(token, '000001')).toEqual({ ok: false, reason: 'pin_locked' });
    expect(await DeviceCredential.countDocuments({ userId: user.id })).toBe(0);
    // Even the right PIN is no use now: the password is needed again.
    expect(await verifyDevicePin(token, '482913')).toEqual({
      ok: false,
      reason: 'unknown_device',
    });
    const reasons = (await LoginEvent.find({ userId: user.id }).lean()).map((row) => row.reason);
    expect(reasons.filter((reason) => reason === 'bad_pin')).toHaveLength(MAX_PIN_ATTEMPTS - 1);
    expect(reasons).toContain('pin_locked');
  });

  it('starts the count again after a right PIN', async () => {
    const user = await person();
    const { token } = await enrolDevicePin(user, '482913', null, null);
    await verifyDevicePin(token, '000001');
    await verifyDevicePin(token, '482913');

    const credential = await DeviceCredential.findOne({ userId: user.id }).lean();
    expect(credential?.failedAttempts).toBe(0);
  });

  it('fails without a device cookie, or with an unknown one', async () => {
    expect(await verifyDevicePin(null, '482913')).toEqual({ ok: false, reason: 'unknown_device' });
    expect(await verifyDevicePin('made-up-token', '482913')).toEqual({
      ok: false,
      reason: 'unknown_device',
    });
  });

  it("never lets one person's PIN open another person's device", async () => {
    const ramesh = await person('Ramesh');
    const sita = await person('Sita');
    const rameshDevice = await enrolDevicePin(ramesh, '482913', null, null);
    await enrolDevicePin(sita, '730264', null, null);

    expect(await verifyDevicePin(rameshDevice.token, '730264')).toEqual({
      ok: false,
      reason: 'bad_pin',
    });
  });

  it('refuses a disabled person, one whose PIN was turned off, and a PIN older than a forced sign-out', async () => {
    const disabled = await person();
    const off = await person();
    const stale = await person();
    const tokens = await Promise.all(
      [disabled, off, stale].map(
        async (user) => (await enrolDevicePin(user, '482913', null, null)).token,
      ),
    );
    await User.updateOne({ _id: disabled.id }, { $set: { disabledAt: new Date() } });
    await User.updateOne({ _id: off.id }, { $set: { pinSignInAllowed: false } });
    await User.updateOne(
      { _id: stale.id },
      { $set: { sessionsValidFrom: new Date(Date.now() + 1000) } },
    );

    for (const token of tokens) {
      expect(await verifyDevicePin(token, '482913')).toEqual({
        ok: false,
        reason: 'unknown_device',
      });
    }
    expect(await DeviceCredential.countDocuments()).toBe(0);
  });
});

describe('devicePinGreeting', () => {
  it('gives only the first name, in the reader’s language', async () => {
    const user = await person('Ramesh Kumar');
    const { token } = await enrolDevicePin(user, '482913', null, null);

    expect(await devicePinGreeting(token, 'en')).toBe('Ramesh');
    expect(await devicePinGreeting(token, 'hi')).toBe('रमेश');
    expect(await devicePinGreeting('made-up-token', 'en')).toBeNull();
    expect(await devicePinGreeting(null, 'en')).toBeNull();
  });
});

describe('managing PINs', () => {
  it('lists, marks this device, and removes only the person’s own', async () => {
    const user = await person();
    const other = await person();
    const here = await enrolDevicePin(user, '482913', null, ANDROID_CHROME);
    await enrolDevicePin(user, '730264', null, null);
    const theirs = await enrolDevicePin(other, '730264', null, null);

    const rows = await listDevicePins(user, here.token);
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.current)).toHaveLength(1);

    const theirId = (await DeviceCredential.findOne({ userId: other.id }).lean())?._id.toString();
    expect(await removeDevicePin(user, theirId ?? '', here.token)).toEqual({
      removed: false,
      current: false,
    });
    expect((await verifyDevicePin(theirs.token, '730264')).ok).toBe(true);

    const current = rows.find((row) => row.current);
    expect(await removeDevicePin(user, current?.id ?? '', here.token)).toEqual({
      removed: true,
      current: true,
    });
  });

  it('revokes every PIN a person has', async () => {
    const user = await person();
    await enrolDevicePin(user, '482913', null, null);
    await enrolDevicePin(user, '730264', null, null);

    expect(await revokeDevicePins(ORG, user.id)).toBe(2);
    expect(await DeviceCredential.countDocuments()).toBe(0);
  });

  it('offers a PIN only where the person has none and is allowed one', async () => {
    const user = await person();
    expect(await shouldOfferDevicePin(user, null)).toBe(true);
    const { token } = await enrolDevicePin(user, '482913', null, null);
    expect(await shouldOfferDevicePin(user, token)).toBe(false);

    await User.updateOne({ _id: user.id }, { $set: { pinSignInAllowed: false } });
    expect(await shouldOfferDevicePin(user, null)).toBe(false);
  });
});

describe('deviceLabel', () => {
  it('names common browsers and systems, and nothing it does not know', () => {
    expect(deviceLabel(ANDROID_CHROME)).toBe('Chrome · Android');
    expect(
      deviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari · iPhone');
    expect(
      deviceLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 Edg/128.0',
      ),
    ).toBe('Edge · Windows');
    expect(deviceLabel(null)).toBe('');
    expect(deviceLabel('curl/8.0')).toBe('');
  });
});
