/**
 * Where uploaded files are kept. Keys are POSIX-style relative paths
 * (`org/<orgId>/avatars/<assetId>/thumb.webp`) and mean the same thing on
 * every driver, so moving from this server's disk to S3 or R2 is a copy of
 * the files plus a new driver — no data migration.
 */
export type StoredObject = {
  body: ReadableStream<Uint8Array>;
  bytes: number;
  contentType: string;
};

export type StorageDriver = {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  /** Removes every object whose key starts with `prefix`. Missing objects are not an error. */
  deletePrefix(prefix: string): Promise<void>;
};
