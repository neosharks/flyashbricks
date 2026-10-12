// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from '@/lib/mongoose';
import { clearTestDb, startTestDb, stopTestDb } from '@/tests/db';
import { backfillPeopleAvatars } from './migrations';

beforeAll(startTestDb, 180_000);
afterEach(clearTestDb);
afterAll(stopTestDb);

function db() {
  const connection = mongoose.connection.db;
  if (!connection) throw new Error('not connected');
  return connection;
}

describe('backfillPeopleAvatars', () => {
  it('rotates cartoons across logins and staff, oldest first, per organisation', async () => {
    const org = new Types.ObjectId();
    const other = new Types.ObjectId();
    const at = (day: number) => new Date(`2026-10-0${day}T00:00:00Z`);
    await db()
      .collection('users')
      .insertMany([
        { orgId: org, name: 'First', createdAt: at(1) },
        { orgId: org, name: 'Third', createdAt: at(3) },
        { orgId: other, name: 'Elsewhere', createdAt: at(1) },
      ]);
    await db()
      .collection('staff_members')
      .insertOne({ orgId: org, name: 'Second', createdAt: at(2) });

    const counts = await backfillPeopleAvatars(db());

    expect(counts).toEqual({ users: 3, staff: 1 });
    const variant = async (collection: string, name: string) =>
      (await db().collection(collection).findOne({ name }))?.avatarVariant as number;
    expect(await variant('users', 'First')).toBe(0);
    expect(await variant('staff_members', 'Second')).toBe(1);
    expect(await variant('users', 'Third')).toBe(2);
    expect(await variant('users', 'Elsewhere')).toBe(0);
    expect((await db().collection('users').findOne({ name: 'First' }))?.gender).toBe('unspecified');
  });

  it('keeps chosen genders and cartoons, and does nothing the second time', async () => {
    const org = new Types.ObjectId();
    await db().collection('users').insertOne({
      orgId: org,
      name: 'Set',
      gender: 'female',
      avatarVariant: 42,
      createdAt: new Date(),
    });
    expect(await backfillPeopleAvatars(db())).toEqual({ users: 0, staff: 0 });
    const doc = await db().collection('users').findOne({ name: 'Set' });
    expect(doc).toMatchObject({ gender: 'female', avatarVariant: 42 });
  });
});
