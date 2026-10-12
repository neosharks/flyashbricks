/**
 * Turns a backup file into readable JSON (Extended JSON, so ObjectIds and
 * dates keep their types).
 *
 * Usage:
 *   pnpm backup:decrypt <file.fabk|file.json.gz> [--out backup.json]
 *
 * The passphrase is read from BACKUP_PASSPHRASE, or asked for without echo.
 * Without --out the JSON is written to stdout.
 */
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { readBackupText } from './backup-file';

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' } },
  });
  const file = positionals[0];
  if (!file) {
    console.error('Usage: pnpm backup:decrypt <file> [--out backup.json]');
    process.exitCode = 1;
    return;
  }

  const { text } = await readBackupText(file);
  if (values.out) {
    // The decrypted file holds everything; readable by its owner only.
    await writeFile(values.out, text, { mode: 0o600 });
    console.error(`Decrypted to ${values.out}`);
  } else {
    process.stdout.write(text);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
