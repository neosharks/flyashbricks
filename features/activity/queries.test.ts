// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Types, type ObjectId } from '@/lib/mongoose';
import { clearTestDb, startTestDb, stopTestDb } from '@/tests/db';
import { aUser } from '@/tests/factories';
import { NO_ACCESS, type SessionUser } from '@/lib/permissions';
import { AuditLog } from '@/models/audit-log';
import { LoginEvent } from '@/models/login-event';
import { User } from '@/models/user';

// The test connects Mongoose itself; the app's connector would look for MONGODB_URI.
vi.mock('@/lib/db', () => ({ connectDb: () => Promise.resolve() }));

const { actorAvatars, groupActivity, listActivity } = await import('./queries');
const { getLoginHistory, groupUsers } = await import('@/features/users/queries');

beforeAll(startTestDb, 180_000);
afterEach(clearTestDb);
afterAll(stopTestDb);

const TZ = 'Asia/Kolkata';
const ORG = new Types.ObjectId();
const viewer: SessionUser = {
  id: new Types.ObjectId().toString(),
  orgId: ORG.toString(),
  name: 'Owner',
  role: 'admin',
  permissions: NO_ACCESS,
  mustChangePassword: false,
};
const ALL = { preset: 'all' as const, from: null, to: null };

async function log(
  actorId: ObjectId | null,
  actorName: string | null,
  entity: string,
  orgId = ORG,
) {
  await AuditLog.create({
    orgId,
    actorUserId: actorId,
    actorName,
    action: 'x.y',
    entity,
    entityId: '1',
  });
}

describe('activity', () => {
  it('groups by person and filters by one person, within the organisation only', async () => {
    const rajesh = new Types.ObjectId();
    const pooja = new Types.ObjectId();
    await log(rajesh, 'Rajesh', 'Sale');
    await log(rajesh, 'Rajesh', 'Customer');
    await log(pooja, 'Pooja', 'Sale');
    await log(rajesh, 'Rajesh', 'Sale', new Types.ObjectId());

    const byPerson = await groupActivity(
      viewer,
      'person',
      { entity: null, userId: null, range: ALL, q: '' },
      TZ,
    );
    expect(byPerson.map((row) => [row.label, row.changes])).toEqual([
      ['Rajesh', 2],
      ['Pooja', 1],
    ]);

    const byArea = await groupActivity(
      viewer,
      'area',
      { entity: null, userId: rajesh.toString(), range: ALL, q: '' },
      TZ,
    );
    expect(byArea.map((row) => [row.key, row.changes]).sort()).toEqual([
      ['Customer', 1],
      ['Sale', 1],
    ]);

    const list = await listActivity(viewer, {
      sort: 'createdAt',
      dir: 'desc',
      after: null,
      before: null,
      size: 50,
      entity: null,
      userId: pooja.toString(),
      q: '',
    });
    expect(list.rows.map((row) => row.actorName)).toEqual(['Pooja']);
  });

  it('fetches photos for a page of people in one go, and never from another company', async () => {
    const mine = await aUser(ORG);
    const theirs = await aUser(new Types.ObjectId());
    const avatars = await actorAvatars(viewer, [mine._id.toString(), theirs._id.toString(), null]);
    expect([...avatars.keys()]).toEqual([mine._id.toString()]);
  });
});

describe('employees', () => {
  it('counts people per status, treating never-signed-in as its own group', async () => {
    const used = await aUser(ORG, { role: 'employee' });
    await User.updateOne({ _id: used._id }, { $set: { lastLoginAt: new Date() } });
    await aUser(ORG, { role: 'employee' });
    await aUser(ORG, { role: 'admin', disabled: true });
    await aUser(new Types.ObjectId());

    const byStatus = await groupUsers(viewer, 'status', { status: null, role: null, q: '' });
    expect(byStatus.map((row) => [row.key, row.people])).toEqual([
      ['active', 1],
      ['disabled', 1],
      ['pending', 1],
    ]);
    const byRole = await groupUsers(viewer, 'role', { status: null, role: null, q: '' });
    expect(byRole.find((row) => row.key === 'employee')).toMatchObject({
      people: 2,
      active: 1,
      pending: 1,
    });
  });

  it('pages sign-in history and filters failures', async () => {
    const user = await aUser(ORG);
    for (let index = 0; index < 5; index += 1) {
      await LoginEvent.create({
        orgId: ORG,
        userId: user._id,
        success: index % 2 === 0,
        reason: index % 2 === 0 ? null : 'bad_password',
      });
    }
    const params = {
      sort: 'createdAt' as const,
      dir: 'desc' as const,
      before: null,
      size: 2,
      q: '',
    };

    const first = await getLoginHistory(viewer, user._id.toString(), {
      ...params,
      after: null,
      result: null,
    });
    const second = await getLoginHistory(viewer, user._id.toString(), {
      ...params,
      after: first.next,
      result: null,
    });
    expect(first.rows).toHaveLength(2);
    expect(second.rows).toHaveLength(2);
    expect(new Set([...first.rows, ...second.rows].map((row) => row.id)).size).toBe(4);

    const failed = await getLoginHistory(viewer, user._id.toString(), {
      ...params,
      size: 25,
      after: null,
      result: 'failed',
    });
    expect(failed.rows.every((row) => !row.success)).toBe(true);
    expect(failed.rows).toHaveLength(2);
  });
});
