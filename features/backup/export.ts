import 'server-only';
import { EJSON, type Document } from './bson';
import { Types } from '@/lib/mongoose';
import { NotFoundError } from '@/lib/errors';
import { Organization } from '@/models/organization';
import { Counter } from '@/models/counter';
import { escapeRegex } from '@/lib/utils';
import {
  BACKUP_COLLECTIONS,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupCollectionName,
} from './collections';

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: Date;
  /** Whether users' password hashes are included (encrypted backups only). */
  includesSecrets: boolean;
  organization: Document;
  counts: Record<BackupCollectionName, number>;
  collections: Record<BackupCollectionName, Document[]>;
};

/**
 * Collects everything one organisation owns. Strictly scoped: every read is
 * filtered by `orgId`, so a backup can never contain another company's data.
 *
 * Password hashes are only included when the caller is going to encrypt the
 * file: they are needed for a faithful restore, but even a bcrypt hash does not
 * belong in a plain file on someone's laptop.
 *
 * The caller connects to the database first.
 */
export async function buildBackup(
  orgId: string,
  options: { includeSecrets: boolean },
): Promise<Backup> {
  const id = new Types.ObjectId(orgId);

  const organization = await Organization.collection.findOne({ _id: id });
  if (!organization) throw new NotFoundError('Organization');

  const collections = {} as Record<BackupCollectionName, Document[]>;
  for (const [name, model] of Object.entries(BACKUP_COLLECTIONS)) {
    const rows: Document[] = [];
    for await (const doc of model.collection.find({ orgId: id }).sort({ _id: 1 })) {
      if (name === 'users' && !options.includeSecrets) delete doc.passwordHash;
      rows.push(doc);
    }
    collections[name as BackupCollectionName] = rows;
  }

  collections.counters = await Counter.collection
    .find({ _id: { $regex: `^${escapeRegex(orgId)}:` } } as Document)
    .toArray();

  const counts = Object.fromEntries(
    Object.entries(collections).map(([name, rows]) => [name, rows.length]),
  ) as Record<BackupCollectionName, number>;

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date(),
    includesSecrets: options.includeSecrets,
    organization,
    counts,
    collections,
  };
}

/**
 * Canonical Extended JSON keeps ObjectIds, Dates and numbers exactly typed,
 * so a restore puts back what was there rather than strings that look like it.
 */
export function serializeBackup(backup: Backup): Buffer {
  return Buffer.from(EJSON.stringify(backup, { relaxed: false }), 'utf8');
}

export function totalRecords(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}
