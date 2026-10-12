import { describe, expect, it } from 'vitest';
import { formatSaleNumber, generateTemporaryPassword } from './ids';

describe('generateTemporaryPassword', () => {
  it('is three readable groups with no look-alike characters', () => {
    const password = generateTemporaryPassword();
    expect(password).toMatch(/^[2-9A-HJKMNP-TV-Z]{5}-[2-9A-HJKMNP-TV-Z]{5}-[2-9A-HJKMNP-TV-Z]{5}$/);
  });

  it('is long enough to satisfy the password policy', () => {
    expect(generateTemporaryPassword().length).toBeGreaterThanOrEqual(10);
  });

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 200 }, generateTemporaryPassword));
    expect(seen.size).toBe(200);
  });
});

describe('formatSaleNumber', () => {
  it('pads to four digits and grows past them', () => {
    expect(formatSaleNumber(7)).toBe('S-0007');
    expect(formatSaleNumber(12345)).toBe('S-12345');
  });
});
