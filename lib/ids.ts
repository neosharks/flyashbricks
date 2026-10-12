import { randomInt } from 'node:crypto';

/** Crockford base32 without look-alikes (no I, L, O, U, 0, 1). */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * A temporary password an admin reads out or messages to a new employee.
 * Grouped for reading aloud; 15 random characters is ~73 bits, and it only
 * has to survive until the first sign-in, which forces a change.
 */
export function generateTemporaryPassword(): string {
  const groups: string[] = [];
  for (let group = 0; group < 3; group += 1) {
    let chunk = '';
    for (let index = 0; index < 5; index += 1) chunk += ALPHABET.charAt(randomInt(ALPHABET.length));
    groups.push(chunk);
  }
  return groups.join('-');
}

/** An unused temporary password stops working after this long. */
export const TEMPORARY_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000;

export function temporaryPasswordExpiry(now = new Date()): Date {
  return new Date(now.getTime() + TEMPORARY_PASSWORD_TTL_MS);
}

export function formatSaleNumber(number: number): string {
  return `S-${String(number).padStart(4, '0')}`;
}
