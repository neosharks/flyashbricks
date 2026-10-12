/**
 * Restores one organisation from a backup file into the database in
 * MONGODB_URI.
 *
 * Usage:
 *   pnpm backup:restore <file.fabk|file.json.gz>                 # only if the organisation is not there
 *   pnpm backup:restore <file> --replace --yes                   # delete it first, then restore
 *
 * Run `pnpm db:migrate` first on a fresh database so the indexes exist.
 */
import { parseArgs } from 'node:util';
import { connectDb, disconnectDb } from '../lib/db';
import { parseBackup, restoreBackup } from '../features/backup/restore';
import { readBackupText } from './backup-file';

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      replace: { type: 'boolean', default: false },
      yes: { type: 'boolean', default: false },
    },
  });
  const file = positionals[0];
  if (!file) {
    console.error('Usage: pnpm backup:restore <file> [--replace --yes]');
    process.exitCode = 1;
    return;
  }
  if (values.replace && !values.yes) {
    console.error('--replace deletes the organisation’s current data first. Add --yes to confirm.');
    process.exitCode = 1;
    return;
  }

  const { text, encrypted } = await readBackupText(file);
  const backup = parseBackup(text);
  console.log(
    `Backup of "${String(backup.organization.name)}" taken ${backup.createdAt.toISOString()}`,
  );

  await connectDb();
  try {
    const result = await restoreBackup(backup, {
      replace: values.replace,
      keepPasswordHashes: encrypted,
    });
    console.log(`\nRestored organisation ${result.orgId}:`);
    for (const [name, count] of Object.entries(result.counts)) console.log(`  ${name}: ${count}`);

    if (result.temporaryPasswords.length > 0) {
      console.log(
        encrypted
          ? '\nThis backup had no passwords. Temporary passwords (shown once):'
          : '\nPasswords are never taken from an unencrypted file. Temporary passwords (shown once):',
      );
      for (const user of result.temporaryPasswords) {
        console.log(`  ${user.name} (${user.phone}): ${user.password}`);
      }
    }
  } finally {
    await disconnectDb();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
