// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from '@/lib/mongoose';
import { MODULES, type Permissions, type SessionUser } from '@/lib/permissions';
import { clearTestDb, startTestDb, stopTestDb, syncIndexes } from '@/tests/db';
import { aUser } from '@/tests/factories';
import { DeviceCredential } from '@/models/device-credential';
import { User, type UserDoc } from '@/models/user';

const mocks = vi.hoisted(() => ({
  actor: null as SessionUser | null,
  recordAudit: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next-intl/server', () => ({
  getTranslations: () => Promise.resolve(Object.assign((key: string) => key, { has: () => false })),
}));
vi.mock('@/lib/db', () => ({ connectDb: () => Promise.resolve() }));
vi.mock('@/lib/audit', () => ({ recordAudit: mocks.recordAudit }));
vi.mock('@/features/notifications/notify', () => ({ notify: vi.fn() }));
vi.mock('@/lib/session', async () => {
  const { can } = await import('@/lib/permissions');
  const { ForbiddenError } = await import('@/lib/errors');
  return {
    requirePermission: (action: Parameters<typeof can>[1]) => {
      const actor = mocks.actor;
      if (!actor || !can(actor, action)) return Promise.reject(new ForbiddenError());
      return Promise.resolve(actor);
    },
  };
});

const { createUser, resetUserPassword, setUserDisabled, signOutUserEverywhere, updateUser } =
  await import('./actions');

const ORG = new Types.ObjectId().toString();
const MANAGER: Partial<Permissions> = { users: 'write', sales: 'write' };

beforeAll(async () => {
  await startTestDb();
  await syncIndexes([User, DeviceCredential]);
}, 180_000);
beforeEach(() => mocks.recordAudit.mockReset());
afterEach(clearTestDb);
afterAll(stopTestDb);

function asActor(doc: UserDoc): SessionUser {
  return {
    id: doc._id.toString(),
    orgId: doc.orgId.toString(),
    name: doc.name,
    role: doc.role,
    permissions: Object.fromEntries(
      MODULES.map((module) => [module, doc.permissions[module] ?? 'none']),
    ) as Permissions,
    mustChangePassword: false,
  };
}

async function withPins(doc: UserDoc, count = 2): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await DeviceCredential.create({
      orgId: doc.orgId,
      userId: doc._id,
      tokenHash: new Types.ObjectId().toString(),
      pinHash: 'x',
      expiresAt: new Date(Date.now() + 60_000),
    });
  }
}

/** The edit form as it posts: everything unchanged except `overrides`. */
function editForm(doc: UserDoc, overrides: Record<string, string | null> = {}): FormData {
  const fields: Record<string, string | null> = {
    id: doc._id.toString(),
    name: doc.name,
    phone: doc.phone,
    gender: 'male',
    role: doc.role,
    ...Object.fromEntries(
      MODULES.map((module) => [`perm_${module}`, doc.permissions[module] ?? 'none']),
    ),
    pinSignInAllowed: doc.pinSignInAllowed ? 'on' : null,
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value !== null) data.set(key, value);
  return data;
}

const pins = (doc: UserDoc) => DeviceCredential.countDocuments({ userId: doc._id });

describe('quick sign-in switch', () => {
  it('turning it off removes the person’s PINs at once and is recorded', async () => {
    const admin = await aUser(ORG);
    const worker = await aUser(ORG, { role: 'employee' });
    await withPins(worker);
    mocks.actor = asActor(admin);

    const result = await updateUser(null, editForm(worker, { pinSignInAllowed: null }));

    expect(result).toEqual({ ok: true, data: undefined });
    expect((await User.findById(worker._id).lean())?.pinSignInAllowed).toBe(false);
    expect(await pins(worker)).toBe(0);
    const audit = mocks.recordAudit.mock.calls[0]?.[0] as {
      action: string;
      changes: Record<string, unknown>;
    };
    expect(audit.action).toBe('user.access_change');
    expect(audit.changes.pinSignInAllowed).toEqual({ from: true, to: false });
  });

  it('an ordinary edit leaves the switch and the PINs alone', async () => {
    const admin = await aUser(ORG);
    const worker = await aUser(ORG, { role: 'employee' });
    await withPins(worker);
    mocks.actor = asActor(admin);

    expect((await updateUser(null, editForm(worker, { jobTitle: 'Supervisor' }))).ok).toBe(true);
    expect(await pins(worker)).toBe(2);
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.update' }),
    );
  });

  it('can be set when the login is created', async () => {
    const admin = await aUser(ORG);
    mocks.actor = asActor(admin);
    const data = new FormData();
    for (const [key, value] of Object.entries({
      name: 'Sita Devi',
      phone: '9876501234',
      gender: 'female',
      role: 'employee',
      perm_sales: 'read',
    })) {
      data.set(key, value);
    }

    const result = await createUser(null, data);

    expect(result.ok).toBe(true);
    expect((await User.findOne({ phone: '9876501234' }).lean())?.pinSignInAllowed).toBe(false);
    data.set('phone', '9876501235');
    data.set('pinSignInAllowed', 'on');
    await createUser(null, data);
    expect((await User.findOne({ phone: '9876501235' }).lean())?.pinSignInAllowed).toBe(true);
  });

  it('an employee who manages logins cannot switch it for an admin', async () => {
    const admin = await aUser(ORG);
    const manager = await aUser(ORG, { role: 'employee', permissions: MANAGER });
    await withPins(admin);
    mocks.actor = asActor(manager);

    const result = await updateUser(null, editForm(admin, { pinSignInAllowed: null }));

    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect((await User.findById(admin._id).lean())?.pinSignInAllowed).toBe(true);
    expect(await pins(admin)).toBe(2);
  });

  it('nobody switches their own', async () => {
    const admin = await aUser(ORG);
    await aUser(ORG);
    mocks.actor = asActor(admin);

    const result = await updateUser(null, editForm(admin, { pinSignInAllowed: null }));
    expect(result).toMatchObject({ ok: false, code: 'CANNOT_CHANGE_SELF' });
  });
});

describe('ending every PIN', () => {
  it('on a password reset, a forced sign-out and disabling the account', async () => {
    const admin = await aUser(ORG);
    mocks.actor = asActor(admin);
    const reset = await aUser(ORG, { role: 'employee' });
    const signedOut = await aUser(ORG, { role: 'employee' });
    const disabled = await aUser(ORG, { role: 'employee' });
    for (const doc of [reset, signedOut, disabled]) await withPins(doc);

    expect((await resetUserPassword(reset._id.toString())).ok).toBe(true);
    expect((await signOutUserEverywhere(signedOut._id.toString())).ok).toBe(true);
    expect((await setUserDisabled(disabled._id.toString(), true)).ok).toBe(true);

    for (const doc of [reset, signedOut, disabled]) expect(await pins(doc)).toBe(0);
  });
});
