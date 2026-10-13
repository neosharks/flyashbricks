import 'server-only';
import { EJSON, type Document } from './bson';
import mongoose, { Types, type ObjectId } from '@/lib/mongoose';
import { hashPassword } from '@/lib/password';
import { generateTemporaryPassword } from '@/lib/ids';
import { escapeRegex } from '@/lib/utils';
import { Organization } from '@/models/organization';
import { Counter } from '@/models/counter';
import { DeviceCredential } from '@/models/device-credential';
import {
  BACKUP_COLLECTIONS,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupCollectionName,
} from './collections';
import type { Backup } from './export';

const BATCH_SIZE = 500;

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupFormatError';
  }
}

export class RestoreConflictError extends Error {
  constructor(orgId: string) {
    super(
      `Organisation ${orgId} already exists in this database. Pass --replace --yes to overwrite it.`,
    );
    this.name = 'RestoreConflictError';
  }
}

function isDocument(value: unknown): value is Document {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Every row must belong to the organisation the backup is for. A file edited
 * by hand, or stitched together from two companies' backups, could otherwise
 * write rows into another organisation that happens to share the database.
 */
function assertRowsBelongTo(orgId: ObjectId, collections: Backup['collections']): void {
  for (const name of Object.keys(BACKUP_COLLECTIONS) as BackupCollectionName[]) {
    collections[name].forEach((row: unknown, index) => {
      if (!isDocument(row) || !(row._id instanceof Types.ObjectId)) {
        throw new BackupFormatError(`Row ${index} of "${name}" is not a valid record.`);
      }
      if (!(row.orgId instanceof Types.ObjectId) || !row.orgId.equals(orgId)) {
        throw new BackupFormatError(`Row ${index} of "${name}" belongs to another organisation.`);
      }
    });
  }
  const prefix = `${orgId.toString()}:`;
  collections.counters.forEach((row: unknown, index) => {
    if (!isDocument(row) || typeof row._id !== 'string' || !row._id.startsWith(prefix)) {
      throw new BackupFormatError(`Counter ${index} belongs to another organisation.`);
    }
  });
}

/** Parses and sanity-checks a decrypted backup before anything touches the database. */
export function parseBackup(text: string): Backup {
  let parsed: unknown;
  try {
    // Relaxed parsing turns typed numbers back into plain JS numbers (the app
    // stores only integers and safe doubles) while ObjectIds and Dates keep
    // their types.
    parsed = EJSON.parse(text, { relaxed: true });
  } catch {
    throw new BackupFormatError('The file is not valid backup JSON.');
  }

  const backup = parsed as Partial<Backup> | null;
  if (backup?.format !== BACKUP_FORMAT) throw new BackupFormatError('Not a Fly Ash Bricks backup.');
  if (backup.version !== BACKUP_VERSION) {
    throw new BackupFormatError(`Unsupported backup version ${String(backup.version)}.`);
  }
  if (!(backup.organization?._id instanceof Types.ObjectId)) {
    throw new BackupFormatError('The backup has no organisation.');
  }
  for (const name of [...Object.keys(BACKUP_COLLECTIONS), 'counters']) {
    if (!Array.isArray(backup.collections?.[name as BackupCollectionName])) {
      throw new BackupFormatError(`The backup is missing the "${name}" collection.`);
    }
  }
  const valid = backup as Backup;
  assertRowsBelongTo(valid.organization._id as ObjectId, valid.collections);
  return valid;
}

export type RestoreResult = {
  orgId: string;
  counts: Record<string, number>;
  /**
   * Users restored without a password hash (a backup made without them, or
   * an unencrypted file) get a fresh temporary password, printed once to
   * whoever runs the restore.
   */
  temporaryPasswords: { name: string; phone: string; password: string }[];
};

async function withTransaction(
  fn: (session: mongoose.ClientSession) => Promise<void>,
): Promise<void> {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(() => fn(session));
  } finally {
    await session.endSession();
  }
}

async function removeOrganisation(orgId: ObjectId): Promise<void> {
  await withTransaction(async (session) => {
    for (const model of Object.values(BACKUP_COLLECTIONS)) {
      await model.collection.deleteMany({ orgId }, { session });
    }
    await DeviceCredential.collection.deleteMany({ orgId }, { session });
    await Counter.collection.deleteMany(
      { _id: { $regex: `^${escapeRegex(orgId.toString())}:` } } as Document,
      { session },
    );
    await Organization.collection.deleteOne({ _id: orgId }, { session });
  });
}

/**
 * Writes a parsed backup into the connected database.
 *
 * Refuses to overwrite an organisation that already exists unless `replace`
 * is set. Each batch is its own transaction: a backup can be far larger than
 * one transaction may hold, so a failed restore can leave a partial copy —
 * which a second run with `replace` cleans up.
 *
 * Password hashes are kept only when `keepPasswordHashes` is set, which the
 * caller does for encrypted files alone. Those are authenticated, so their
 * hashes are the ones the app exported; an unencrypted file never carries
 * hashes legitimately, and one that does could have had a known password
 * planted on an admin.
 */
export async function restoreBackup(
  backup: Backup,
  options: { replace: boolean; keepPasswordHashes: boolean },
): Promise<RestoreResult> {
  const orgId = backup.organization._id as ObjectId;

  const existing = await Organization.collection.findOne({ _id: orgId });
  if (existing && !options.replace) throw new RestoreConflictError(orgId.toString());
  if (existing) await removeOrganisation(orgId);

  await Organization.collection.insertOne(backup.organization);

  const temporaryPasswords: RestoreResult['temporaryPasswords'] = [];
  const users = backup.collections.users;
  for (const user of users) {
    if (options.keepPasswordHashes && typeof user.passwordHash === 'string') continue;
    const password = generateTemporaryPassword();
    user.passwordHash = await hashPassword(password);
    user.mustChangePassword = true;
    user.sessionsValidFrom = new Date();
    temporaryPasswords.push({ name: String(user.name), phone: String(user.phone), password });
  }

  const counts: Record<string, number> = {};
  const targets = [
    ...Object.entries(BACKUP_COLLECTIONS).map(([name, model]) => [name, model.collection] as const),
    ['counters', Counter.collection] as const,
  ];

  for (const [name, collection] of targets) {
    const rows = backup.collections[name as BackupCollectionName];
    for (let index = 0; index < rows.length; index += BATCH_SIZE) {
      const batch = rows.slice(index, index + BATCH_SIZE);
      await withTransaction(async (session) => {
        await collection.insertMany(batch, { session, ordered: true });
      });
    }
    counts[name] = rows.length;
  }

  return { orgId: orgId.toString(), counts, temporaryPasswords };
}
