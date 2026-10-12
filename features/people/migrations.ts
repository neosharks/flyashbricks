import type { mongo } from 'mongoose';
import { AVATAR_VARIANTS } from '@/models/constants';

type Db = { collection(name: string): mongo.Collection };

function createdTime(doc: mongo.Document): number {
  const value: unknown = doc.createdAt;
  return value instanceof Date ? value.getTime() : 0;
}

/**
 * Data migration 4: people added before gender and cartoon pictures existed
 * get gender "unspecified" (shown as "not set" until someone chooses) and a
 * cartoon from the same rotation new people get — app logins and staff
 * counted together, oldest first, within each organisation. Only missing
 * fields are written, so it is safe to run again.
 */
export async function backfillPeopleAvatars(db: Db): Promise<{ users: number; staff: number }> {
  const collections = { users: db.collection('users'), staff: db.collection('staff_members') };
  const people: { kind: keyof typeof collections; doc: mongo.Document }[] = [];
  for (const kind of ['users', 'staff'] as const) {
    for await (const doc of collections[kind].find(
      {},
      { projection: { orgId: 1, createdAt: 1, gender: 1, avatarVariant: 1 } },
    )) {
      people.push({ kind, doc });
    }
  }

  const byOrg = new Map<string, typeof people>();
  for (const person of people) {
    const key = String(person.doc.orgId);
    byOrg.set(key, [...(byOrg.get(key) ?? []), person]);
  }

  const counts = { users: 0, staff: 0 };
  for (const members of byOrg.values()) {
    members.sort(
      (a, b) =>
        createdTime(a.doc) - createdTime(b.doc) ||
        String(a.doc._id).localeCompare(String(b.doc._id)),
    );
    for (const [index, { kind, doc }] of members.entries()) {
      const set: Record<string, unknown> = {};
      if (!('gender' in doc)) set.gender = 'unspecified';
      if (!('avatarVariant' in doc)) set.avatarVariant = index % AVATAR_VARIANTS;
      if (Object.keys(set).length === 0) continue;
      const id = doc._id as mongo.BSON.ObjectId;
      await collections[kind].updateOne({ _id: id }, { $set: set });
      counts[kind] += 1;
    }
  }
  return counts;
}
