import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { gunzip, gzip } from 'node:zlib';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Backup file format, version 2 (written now):
 *
 *   "FABK2\n" | log2(N) (1) | r (1) | p (1) | salt (16) | iv (12) | auth tag (16)
 *             | AES-256-GCM(gzip(payload))
 *
 * The scrypt cost is stored in the header and bound into the GCM tag as
 * additional data, so it can be raised later without a new format, and a
 * file whose header was edited fails to open. Version 1 ("FABK1\n", fixed
 * N=2^15, no parameters in the header) is still read.
 *
 * The key comes from a passphrase via scrypt, so the file is safe to keep on
 * a USB stick or send by email: without the passphrase it is noise, and GCM's
 * tag means any tampering is detected rather than silently restored.
 */
export const BACKUP_MAGIC = Buffer.from('FABK2\n', 'ascii');
const MAGIC_V1 = Buffer.from('FABK1\n', 'ascii');

const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PARAM_BYTES = 3;

type ScryptParams = { logN: number; r: number; p: number };

/** OWASP's floor: N=2^17, r=8, p=1 — about 128MB and a few hundred ms per derivation. */
const CURRENT: ScryptParams = { logN: 17, r: 8, p: 1 };
const V1: ScryptParams = { logN: 15, r: 8, p: 1 };

/**
 * Bounds on what a file may ask for. Without them a crafted header could make
 * decryption allocate gigabytes or run for minutes.
 */
const LIMITS = { logN: [14, 20], r: [1, 16], p: [1, 4] } as const;

/** Applies to every backup passphrase: typed, emailed and the scheduled one. */
export const MIN_PASSPHRASE_LENGTH = 16;

export class BackupDecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupDecryptError';
  }
}

function deriveKey(passphrase: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  const N = 2 ** params.logN;
  return scryptAsync(passphrase.normalize('NFKC'), salt, 32, {
    N,
    r: params.r,
    p: params.p,
    // scrypt needs 128·N·r bytes; leave headroom so Node does not refuse.
    maxmem: 128 * N * params.r * 2,
  });
}

export async function encryptBackup(plain: Buffer, passphrase: string): Promise<Buffer> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Backup passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`);
  }
  const params = Buffer.from([CURRENT.logN, CURRENT.r, CURRENT.p]);
  const header = Buffer.concat([BACKUP_MAGIC, params]);
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(passphrase, salt, CURRENT);

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(header);
  const ciphertext = Buffer.concat([cipher.update(await gzipAsync(plain)), cipher.final()]);

  return Buffer.concat([header, salt, iv, cipher.getAuthTag(), ciphertext]);
}

export function isEncryptedBackup(file: Buffer): boolean {
  const start = file.subarray(0, BACKUP_MAGIC.length);
  return start.equals(BACKUP_MAGIC) || start.equals(MAGIC_V1);
}

function readHeader(file: Buffer): { header: Buffer; params: ScryptParams } {
  if (file.subarray(0, MAGIC_V1.length).equals(MAGIC_V1)) {
    return { header: MAGIC_V1, params: V1 };
  }
  const header = file.subarray(0, BACKUP_MAGIC.length + PARAM_BYTES);
  if (header.length < BACKUP_MAGIC.length + PARAM_BYTES) {
    throw new BackupDecryptError('The backup file is truncated.');
  }
  const [logN = 0, r = 0, p = 0] = header.subarray(BACKUP_MAGIC.length);
  const within = (value: number, [min, max]: readonly [number, number]) =>
    value >= min && value <= max;
  if (!within(logN, LIMITS.logN) || !within(r, LIMITS.r) || !within(p, LIMITS.p)) {
    throw new BackupDecryptError('The backup file has an invalid header.');
  }
  return { header, params: { logN, r, p } };
}

export async function decryptBackup(file: Buffer, passphrase: string): Promise<Buffer> {
  if (!isEncryptedBackup(file)) {
    throw new BackupDecryptError('This is not an encrypted Fly Ash Bricks backup file.');
  }
  const { header, params } = readHeader(file);
  const start = header.length;
  const salt = file.subarray(start, start + SALT_BYTES);
  const iv = file.subarray(start + SALT_BYTES, start + SALT_BYTES + IV_BYTES);
  const tag = file.subarray(
    start + SALT_BYTES + IV_BYTES,
    start + SALT_BYTES + IV_BYTES + TAG_BYTES,
  );
  const ciphertext = file.subarray(start + SALT_BYTES + IV_BYTES + TAG_BYTES);
  if (tag.length !== TAG_BYTES) throw new BackupDecryptError('The backup file is truncated.');

  const key = await deriveKey(passphrase, salt, params);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(header);
  decipher.setAuthTag(tag);

  let compressed: Buffer;
  try {
    compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    // GCM cannot tell a wrong passphrase from a modified file; both fail here.
    throw new BackupDecryptError(
      'Could not decrypt the backup: the passphrase is wrong or the file has been modified.',
    );
  }
  return gunzipAsync(compressed);
}

/** Unencrypted backups are still gzipped, so the two formats share a reader. */
export function compressBackup(plain: Buffer): Promise<Buffer> {
  return gzipAsync(plain);
}

export function decompressBackup(file: Buffer): Promise<Buffer> {
  return gunzipAsync(file);
}
