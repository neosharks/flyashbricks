import { describe, expect, it } from 'vitest';
import { formatPhone, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['9876543210', '9876543210'],
    ['+91 98765-43210', '9876543210'],
    ['919876543210', '9876543210'],
    ['098765 43210', '9876543210'],
    ['0141 234 5678', '1412345678'],
  ])('reduces %s to the same ten digits', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('rejects numbers that are not Indian ten-digit numbers', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('+44 20 7946 0958')).toBeNull();
    expect(normalizePhone('+1 415 555 0100 22')).toBeNull();
    expect(normalizePhone('0000000000')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
});

describe('formatPhone', () => {
  it('shows the country code and groups the number for reading', () => {
    expect(formatPhone('9876543210')).toBe('+91 98765 43210');
  });
});
