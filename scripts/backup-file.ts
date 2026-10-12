/**
 * Shared by the backup scripts: reads a backup file (encrypted `.fabk` or plain
 * `.json.gz`) and returns its JSON text, asking for the passphrase when needed.
 */
import { readFile } from 'node:fs/promises';
import { decompressBackup, decryptBackup, isEncryptedBackup } from '../lib/backup-crypto';

/** Reads a line from the terminal without echoing it. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error('No terminal to ask for the passphrase: set BACKUP_PASSPHRASE instead.'));
      return;
    }
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          stdin.setRawMode(false);
          reject(new Error('Cancelled'));
          return;
        }
        value = char === '\u007f' ? value.slice(0, -1) : value + char;
      }
    };
    stdin.on('data', onData);
  });
}

/** `encrypted` tells the restore whether the contents are authenticated and can be trusted. */
export async function readBackupText(file: string): Promise<{ text: string; encrypted: boolean }> {
  const content = await readFile(file);
  if (!isEncryptedBackup(content)) {
    return { text: (await decompressBackup(content)).toString('utf8'), encrypted: false };
  }

  // An empty variable (as left by .env.example) counts as unset.
  const fromEnv = process.env.BACKUP_PASSPHRASE?.trim();
  const passphrase =
    fromEnv !== undefined && fromEnv !== '' ? fromEnv : await promptHidden('Backup password: ');
  return { text: (await decryptBackup(content, passphrase)).toString('utf8'), encrypted: true };
}
