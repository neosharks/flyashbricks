import 'server-only';
import bcrypt from 'bcryptjs';

/** OWASP's floor for bcrypt. Raise it, never lower it. */
const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Burns roughly the same time as a real comparison when no account exists, so
 * response timing does not reveal whether an email is registered.
 */
export async function burnTimingBudget(): Promise<void> {
  await bcrypt.compare(
    'timing-budget',
    '$2a$12$1pBRzIg4UCZJ3L/0dTbwNu1ldCK7TxowQQpsfE.HIvCFSkDkCmFCG',
  );
}
