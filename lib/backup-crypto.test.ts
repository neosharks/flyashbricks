// @vitest-environment node
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  BACKUP_MAGIC,
  BackupDecryptError,
  compressBackup,
  decompressBackup,
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
} from './backup-crypto';

const PASSPHRASE = 'correct horse battery staple';
const PAYLOAD = Buffer.from(JSON.stringify({ hello: 'ईंट', n: [1, 2, 3] }), 'utf8');

describe('backup encryption', () => {
  it('round-trips the payload with the right passphrase', async () => {
    const file = await encryptBackup(PAYLOAD, PASSPHRASE);
    expect(isEncryptedBackup(file)).toBe(true);
    expect(file.subarray(0, BACKUP_MAGIC.length).toString('ascii')).toBe('FABK2\n');
    expect((await decryptBackup(file, PASSPHRASE)).equals(PAYLOAD)).toBe(true);
  });

  it('does not contain the plaintext', async () => {
    const file = await encryptBackup(Buffer.from('secret-customer-name'.repeat(20)), PASSPHRASE);
    expect(file.includes(Buffer.from('secret-customer-name'))).toBe(false);
  });

  it('produces a different file every time, even for the same input', async () => {
    const [a, b] = await Promise.all([
      encryptBackup(PAYLOAD, PASSPHRASE),
      encryptBackup(PAYLOAD, PASSPHRASE),
    ]);
    expect(a.equals(b)).toBe(false);
  });

  it('refuses a wrong passphrase with a clear error', async () => {
    const file = await encryptBackup(PAYLOAD, PASSPHRASE);
    await expect(decryptBackup(file, 'not the passphrase')).rejects.toBeInstanceOf(
      BackupDecryptError,
    );
  });

  it('detects a tampered file', async () => {
    const file = await encryptBackup(PAYLOAD, PASSPHRASE);
    const tampered = Buffer.from(file);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
    await expect(decryptBackup(tampered, PASSPHRASE)).rejects.toBeInstanceOf(BackupDecryptError);
  });

  it('rejects a file that is not a backup, or is cut short', async () => {
    await expect(decryptBackup(Buffer.from('hello'), PASSPHRASE)).rejects.toBeInstanceOf(
      BackupDecryptError,
    );
    const file = await encryptBackup(PAYLOAD, PASSPHRASE);
    await expect(decryptBackup(file.subarray(0, 20), PASSPHRASE)).rejects.toBeInstanceOf(
      BackupDecryptError,
    );
  });

  it('refuses a short passphrase when encrypting', async () => {
    await expect(encryptBackup(PAYLOAD, 'short')).rejects.toThrow();
    await expect(encryptBackup(PAYLOAD, 'fifteen chars!!')).rejects.toThrow();
  });

  it('stores the scrypt cost in the header', async () => {
    const file = await encryptBackup(PAYLOAD, PASSPHRASE);
    expect([...file.subarray(BACKUP_MAGIC.length, BACKUP_MAGIC.length + 3)]).toEqual([17, 8, 1]);
  });

  it('rejects a file whose scrypt cost was edited', async () => {
    const file = await encryptBackup(PAYLOAD, PASSPHRASE);
    const lowered = Buffer.from(file);
    lowered[BACKUP_MAGIC.length] = 16;
    await expect(decryptBackup(lowered, PASSPHRASE)).rejects.toBeInstanceOf(BackupDecryptError);

    const absurd = Buffer.from(file);
    absurd[BACKUP_MAGIC.length] = 40;
    await expect(decryptBackup(absurd, PASSPHRASE)).rejects.toThrow('invalid header');
  });

  it('still reads version 1 files', async () => {
    // Version 1: "FABK1\n" | salt | iv | tag | ciphertext, scrypt N=2^15, magic as AAD.
    const magic = Buffer.from('FABK1\n', 'ascii');
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = scryptSync(PASSPHRASE, salt, 32, {
      N: 2 ** 15,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(magic);
    const ciphertext = Buffer.concat([cipher.update(gzipSync(PAYLOAD)), cipher.final()]);
    const file = Buffer.concat([magic, salt, iv, cipher.getAuthTag(), ciphertext]);

    expect(isEncryptedBackup(file)).toBe(true);
    expect((await decryptBackup(file, PASSPHRASE)).equals(PAYLOAD)).toBe(true);
  });

  it('round-trips the unencrypted gzip format too', async () => {
    const file = await compressBackup(PAYLOAD);
    expect(isEncryptedBackup(file)).toBe(false);
    expect((await decompressBackup(file)).equals(PAYLOAD)).toBe(true);
  });
});
