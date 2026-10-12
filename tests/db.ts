import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from '@/lib/mongoose';

/**
 * A real MongoDB for data-layer tests. A replica set rather than a standalone,
 * because sales and production write inside transactions, and a standalone
 * server cannot start one.
 */
let server: MongoMemoryReplSet | undefined;

export async function startTestDb(): Promise<void> {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(server.getUri(), { dbName: 'test' });
}

export async function clearTestDb(): Promise<void> {
  const collections = await mongoose.connection.db?.collections();
  await Promise.all((collections ?? []).map((collection) => collection.deleteMany({})));
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await server?.stop();
}

/** Builds the indexes a test depends on. Production does this via a migration. */
export async function syncIndexes(
  models: { syncIndexes: () => Promise<unknown> }[],
): Promise<void> {
  for (const model of models) await model.syncIndexes();
}
