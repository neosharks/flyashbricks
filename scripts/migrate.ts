/**
 * Minimal, versioned, idempotent migration runner.
 *
 * Runs as an explicit pipeline step before the app rolls out. Every migration
 * must be backward compatible: during a rolling deploy the old and new code are
 * both live against this schema.
 *
 * Usage: pnpm db:migrate
 */
import mongoose from '../lib/mongoose';
import { connectDb, disconnectDb } from '../lib/db';
import * as models from '../models';
import { defaultPrefs } from '../features/notifications/prefs';
import { backfillSaleRates } from '../features/sales/migrations';
import { backfillHindiNames } from '../features/i18n/backfill-hindi';
import { backfillPeopleAvatars } from '../features/people/migrations';

type Migration = {
  version: number;
  name: string;
  up: () => Promise<void>;
};

/**
 * Versioned, one-off data migrations. Indexes are NOT listed here — they are
 * declarative and synced on every run (see `syncAllIndexes`), so changing an
 * index definition takes effect without anyone remembering to bump a version.
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'notification preferences replace the low-stock email flag',
    up: async () => {
      const users = mongoose.connection.collection('users');
      const cursor = users.find(
        { notificationPrefs: { $exists: false } },
        { projection: { role: 1, notifyLowStock: 1 } },
      );
      for await (const user of cursor) {
        const role = user.role === 'admin' ? 'admin' : 'employee';
        const prefs = defaultPrefs(role);
        // Someone who had opted in to low-stock email keeps it.
        prefs.stock.email = user.notifyLowStock === true || prefs.stock.email;
        await users.updateOne(
          { _id: user._id },
          { $set: { notificationPrefs: prefs, locale: 'en' }, $unset: { notifyLowStock: '' } },
        );
      }
    },
  },
  {
    version: 2,
    name: 'sales record the price per brick and the usual price',
    up: async () => {
      const updated = await backfillSaleRates(mongoose.connection.collection('sales'));
      console.log(`  · ${updated} sale${updated === 1 ? '' : 's'} back-filled`);
    },
  },
  {
    version: 3,
    name: 'names, cities and addresses gain a Hindi version',
    up: async () => {
      const db = mongoose.connection.db;
      if (!db) throw new Error('No database connection');
      const counts = await backfillHindiNames(db);
      for (const [collection, updated] of Object.entries(counts)) {
        console.log(`  · ${collection}: ${updated} updated`);
      }
    },
  },
  {
    version: 4,
    name: 'everyone gets a gender (not set yet) and a cartoon picture',
    up: async () => {
      const db = mongoose.connection.db;
      if (!db) throw new Error('No database connection');
      const counts = await backfillPeopleAvatars(db);
      console.log(`  · users: ${counts.users} updated, staff: ${counts.staff} updated`);
    },
  },
];

/**
 * Brings the database's indexes in line with the schemas. `autoIndex` is off at
 * runtime, so this is the only place indexes are built.
 *
 * `syncIndexes` also drops indexes the schemas no longer declare, which is the
 * point — but it is why this runs as an explicit deploy step rather than at boot.
 */
async function syncAllIndexes(): Promise<void> {
  console.log('→ syncing indexes');
  for (const [name, model] of Object.entries(models)) {
    const dropped = await model.syncIndexes();
    console.log(`  · ${name}${dropped.length > 0 ? ` (dropped ${dropped.join(', ')})` : ''}`);
  }
}

type MigrationRecord = { version: number; name: string; appliedAt: Date };

async function up(): Promise<void> {
  await connectDb();

  const db = mongoose.connection.db;
  if (!db) throw new Error('No database connection');

  const collection = db.collection<MigrationRecord>('migrations');
  await collection.createIndex({ version: 1 }, { unique: true });

  await syncAllIndexes();

  const applied = new Set((await collection.find().toArray()).map((row) => row.version));

  for (const migration of MIGRATIONS.sort((a, b) => a.version - b.version)) {
    if (applied.has(migration.version)) {
      console.log(`✓ ${migration.version} ${migration.name} (already applied)`);
      continue;
    }

    console.log(`→ ${migration.version} ${migration.name}`);
    await migration.up();
    await collection.insertOne({
      version: migration.version,
      name: migration.name,
      appliedAt: new Date(),
    });
    console.log(`✓ ${migration.version} ${migration.name}`);
  }

  console.log(
    `\nMigrations complete (${MIGRATIONS.length} data migration${MIGRATIONS.length === 1 ? '' : 's'} defined).`,
  );
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'up';

  if (command !== 'up') {
    console.error(`Unknown command "${command}". Only "up" is supported.`);
    process.exitCode = 1;
    return;
  }

  try {
    await up();
  } finally {
    await disconnectDb();
  }
}

main().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
