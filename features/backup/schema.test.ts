import { describe, expect, it } from 'vitest';
import { DownloadBackupSchema, EmailBackupSchema } from './schema';

describe('DownloadBackupSchema', () => {
  it('requires a matching passphrase of at least 16 characters', () => {
    expect(
      DownloadBackupSchema.safeParse({ passphrase: 'short', confirmPassphrase: 'short' }).success,
    ).toBe(false);
    expect(
      DownloadBackupSchema.safeParse({
        passphrase: 'fifteen chars!!',
        confirmPassphrase: 'fifteen chars!!',
      }).success,
    ).toBe(false);
    expect(
      DownloadBackupSchema.safeParse({
        passphrase: 'long enough phrase',
        confirmPassphrase: 'different phrase!',
      }).success,
    ).toBe(false);
    expect(
      DownloadBackupSchema.safeParse({
        passphrase: 'long enough phrase',
        confirmPassphrase: 'long enough phrase',
      }).success,
    ).toBe(true);
  });

  it('allows no passphrase only when an unencrypted file is explicitly chosen', () => {
    expect(DownloadBackupSchema.safeParse({}).success).toBe(false);
    expect(
      DownloadBackupSchema.parse({ unencrypted: 'on', currentPassword: 'secret' }).unencrypted,
    ).toBe(true);
  });

  it('asks for the login password before an unencrypted file', () => {
    const parsed = DownloadBackupSchema.safeParse({ unencrypted: 'on' });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(['currentPassword']);
    expect(parsed.error?.issues[0]?.message).toBe('currentPasswordRequired');
  });

  it('rejects unknown fields', () => {
    expect(
      DownloadBackupSchema.safeParse({ unencrypted: 'on', currentPassword: 'x', orgId: 'x' })
        .success,
    ).toBe(false);
  });
});

describe('EmailBackupSchema', () => {
  it('never allows an email without a passphrase', () => {
    expect(
      EmailBackupSchema.safeParse({ to: 'a@b.com', passphrase: '', confirmPassphrase: '' }).success,
    ).toBe(false);
  });

  it('normalises the address', () => {
    const parsed = EmailBackupSchema.parse({
      to: 'Owner@Example.com',
      passphrase: 'long enough phrase',
      confirmPassphrase: 'long enough phrase',
    });
    expect(parsed.to).toBe('owner@example.com');
  });
});
