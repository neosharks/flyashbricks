// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Types, type ObjectId } from '@/lib/mongoose';
import { EJSON } from './bson';
import { clearTestDb, startTestDb, stopTestDb } from '@/tests/db';
import { decryptBackup, encryptBackup } from '@/lib/backup-crypto';
import { Organization } from '@/models/organization';
import { User } from '@/models/user';
import { Customer } from '@/models/customer';
import { Counter } from '@/models/counter';
import { Outbox } from '@/models/outbox';
import { AuditLog } from '@/models/audit-log';
import { BACKUP_COLLECTIONS } from './collections';
import * as allModels from '@/models';
import { buildBackup, serializeBackup } from './export';
import { BackupFormatError, parseBackup, restoreBackup, RestoreConflictError } from './restore';

beforeAll(startTestDb, 180_000);
afterEach(clearTestDb);
afterAll(stopTestDb);

let phoneSeq = 9_000_000_000;

async function seedOrg(name: string) {
  const org = await Organization.create({ name });
  const user = await User.create({
    orgId: org._id,
    name: `${name} admin`,
    phone: String((phoneSeq += 1)),
    passwordHash: '$2a$12$abcdefghijklmnopqrstuuJ0Qn3c0b8m3J7m5a1n1x0Zl1Yl9hP5e',
    role: 'admin',
  });
  const customer = await Customer.create({
    orgId: org._id,
    name: `${name} customer`,
    phones: [String((phoneSeq += 1))],
    lastSaleAt: new Date('2026-09-30T10:00:00Z'),
    createdBy: user._id,
  });
  await Counter.create({ _id: `${org._id.toString()}:sale`, seq: 7 });
  await AuditLog.create({
    orgId: org._id,
    actorUserId: user._id,
    actorName: user.name,
    action: 'customer.create',
    entity: 'Customer',
    entityId: customer._id.toString(),
  });
  return { orgId: org._id.toString(), userId: user._id, customerId: customer._id };
}

describe('buildBackup', () => {
  it('holds exactly one organisation’s records and nothing from another', async () => {
    const mine = await seedOrg('Mine');
    const theirs = await seedOrg('Theirs');
    await Outbox.create({ topic: 'notification.deliver', payload: { orgId: mine.orgId } });

    const backup = await buildBackup(mine.orgId, { includeSecrets: true });
    const text = EJSON.stringify(backup);

    expect(backup.organization.name).toBe('Mine');
    expect(backup.counts.users).toBe(1);
    expect(backup.counts.customers).toBe(1);
    expect(backup.counts.counters).toBe(1);
    expect(backup.counts.auditLogs).toBe(1);
    expect(text).not.toContain('Theirs');
    expect(text).not.toContain(theirs.orgId);
    // The outbox is a delivery queue, not data.
    expect(Object.keys(backup.collections)).not.toContain('outbox');
  });

  it('covers every collection the app scopes by organisation', () => {
    // Derived from the models, so adding an org-scoped collection without
    // adding it to the backup fails here instead of silently losing data.
    // Device PINs are left out on purpose: they belong to a browser, not to the data.
    const scoped = Object.values(allModels)
      .filter((model) => 'orgId' in model.schema.paths && model.modelName !== 'DeviceCredential')
      .map((model) => model.modelName)
      .sort();
    const backedUp = Object.values(BACKUP_COLLECTIONS)
      .map((model) => model.modelName)
      .sort();
    expect(backedUp).toEqual(scoped);
  });

  it('includes password hashes only when asked to (for encrypted files)', async () => {
    const { orgId } = await seedOrg('Mine');
    const withSecrets = await buildBackup(orgId, { includeSecrets: true });
    const without = await buildBackup(orgId, { includeSecrets: false });

    expect(withSecrets.collections.users[0]?.passwordHash).toMatch(/^\$2a\$/);
    expect(without.collections.users[0]).not.toHaveProperty('passwordHash');
    expect(serializeBackup(without).toString('utf8')).not.toContain('passwordHash');
  });

  it('survives encrypt → decrypt → parse with ObjectIds and Dates intact', async () => {
    const { orgId, customerId } = await seedOrg('Mine');
    const file = await encryptBackup(
      serializeBackup(await buildBackup(orgId, { includeSecrets: true })),
      'a long enough passphrase',
    );
    const parsed = parseBackup(
      (await decryptBackup(file, 'a long enough passphrase')).toString('utf8'),
    );

    const customer = parsed.collections.customers[0];
    expect(customer?._id).toBeInstanceOf(Types.ObjectId);
    expect((customer?._id as ObjectId).equals(customerId)).toBe(true);
    expect(customer?.lastSaleAt).toBeInstanceOf(Date);
    expect((customer?.lastSaleAt as Date).toISOString()).toBe('2026-09-30T10:00:00.000Z');
  });
});

describe('restoreBackup', () => {
  it('puts a deleted organisation back exactly as it was', async () => {
    const { orgId, userId } = await seedOrg('Mine');
    const backup = parseBackup(
      serializeBackup(await buildBackup(orgId, { includeSecrets: true })).toString('utf8'),
    );
    await clearTestDb();

    const result = await restoreBackup(backup, { replace: false, keepPasswordHashes: true });

    expect(result.counts.users).toBe(1);
    expect(result.temporaryPasswords).toEqual([]);
    const user = await User.findById(userId).select('+passwordHash').lean();
    expect(user?.passwordHash).toMatch(/^\$2a\$/);
    expect((await Counter.findById(`${orgId}:sale`).lean())?.seq).toBe(7);
    expect(await Customer.countDocuments({ orgId })).toBe(1);
  });

  it('refuses to overwrite an existing organisation unless told to replace it', async () => {
    const { orgId } = await seedOrg('Mine');
    const backup = parseBackup(
      serializeBackup(await buildBackup(orgId, { includeSecrets: true })).toString('utf8'),
    );

    await expect(
      restoreBackup(backup, { replace: false, keepPasswordHashes: true }),
    ).rejects.toBeInstanceOf(RestoreConflictError);

    await Customer.create({
      orgId,
      name: 'Added after the backup',
      phones: ['9999999999'],
      createdBy: new Types.ObjectId(),
    });
    await restoreBackup(backup, { replace: true, keepPasswordHashes: true });
    expect(await Customer.countDocuments({ orgId })).toBe(1);
  });

  it('issues temporary passwords when the backup had no password hashes', async () => {
    const { orgId, userId } = await seedOrg('Mine');
    const backup = parseBackup(
      serializeBackup(await buildBackup(orgId, { includeSecrets: false })).toString('utf8'),
    );
    await clearTestDb();

    const result = await restoreBackup(backup, { replace: false, keepPasswordHashes: true });
    expect(result.temporaryPasswords).toHaveLength(1);
    const user = await User.findById(userId).select('+passwordHash').lean();
    expect(user?.mustChangePassword).toBe(true);
    expect(user?.passwordHash).toMatch(/^\$2/);
  });

  it('never keeps password hashes from an unencrypted file', async () => {
    const { orgId, userId } = await seedOrg('Mine');
    const backup = parseBackup(
      serializeBackup(await buildBackup(orgId, { includeSecrets: true })).toString('utf8'),
    );
    await clearTestDb();

    const result = await restoreBackup(backup, { replace: false, keepPasswordHashes: false });
    expect(result.temporaryPasswords).toHaveLength(1);
    const user = await User.findById(userId).select('+passwordHash').lean();
    expect(user?.passwordHash).not.toBe(
      '$2a$12$abcdefghijklmnopqrstuuJ0Qn3c0b8m3J7m5a1n1x0Zl1Yl9hP5e',
    );
    expect(user?.mustChangePassword).toBe(true);
  });

  it('rejects rows that belong to another organisation', async () => {
    const mine = await seedOrg('Mine');
    const theirs = await seedOrg('Theirs');
    const text = serializeBackup(await buildBackup(mine.orgId, { includeSecrets: false })).toString(
      'utf8',
    );

    const foreignRow = EJSON.parse(text, { relaxed: false }) as {
      collections: Record<string, Record<string, unknown>[]>;
    };
    foreignRow.collections.customers?.push({
      _id: new Types.ObjectId(),
      orgId: new Types.ObjectId(theirs.orgId),
      name: 'Planted',
    });
    expect(() => parseBackup(EJSON.stringify(foreignRow))).toThrow(/another organisation/);

    const foreignCounter = EJSON.parse(text, { relaxed: false }) as {
      collections: Record<string, Record<string, unknown>[]>;
    };
    foreignCounter.collections.counters?.push({ _id: `${theirs.orgId}:sale`, seq: 1 });
    expect(() => parseBackup(EJSON.stringify(foreignCounter))).toThrow(/another organisation/);

    const missingOrg = EJSON.parse(text, { relaxed: false }) as {
      collections: Record<string, Record<string, unknown>[]>;
    };
    missingOrg.collections.customers?.push({ _id: new Types.ObjectId(), name: 'No org' });
    expect(() => parseBackup(EJSON.stringify(missingOrg))).toThrow(BackupFormatError);

    const notARecord = EJSON.parse(text, { relaxed: false }) as {
      collections: Record<string, unknown[]>;
    };
    notARecord.collections.customers?.push('hello');
    expect(() => parseBackup(EJSON.stringify(notARecord))).toThrow(/not a valid record/);
  });

  it('rejects something that is not a backup', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow(BackupFormatError);
    expect(() => parseBackup('not json')).toThrow(BackupFormatError);
  });
});
