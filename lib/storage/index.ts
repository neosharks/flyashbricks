import 'server-only';
import { env } from '@/lib/env';
import { localDriver } from './local';
import type { StorageDriver } from './types';

const globalCache = globalThis as typeof globalThis & { _storage?: StorageDriver };

/** The configured file store. An S3/R2 driver slots in here when the app moves to the cloud. */
export function storage(): StorageDriver {
  globalCache._storage ??= localDriver(env.STORAGE_DIR);
  return globalCache._storage;
}

export type { StorageDriver, StoredObject } from './types';
