import { describe, expect, it } from 'vitest';
import { pressKey } from './number-pad';

const type = (keys: string[], decimals = 0) =>
  keys.reduce((value, key) => pressKey(value, key, decimals), '');

describe('pressKey', () => {
  it('builds whole numbers and erases from the end', () => {
    expect(type(['5', '00', '0'])).toBe('5000');
    expect(type(['1', '2', 'back'])).toBe('1');
    expect(type(['back'])).toBe('');
  });

  it('never starts with a zero', () => {
    expect(type(['0', '00'])).toBe('');
    expect(pressKey('0', '7', 0)).toBe('7');
  });

  it('allows a point only where the unit has decimals, and only so many places', () => {
    expect(type(['4', '.', '5'])).toBe('45');
    expect(type(['4', '.', '5', '2', '5', '9'], 3)).toBe('4.525');
    expect(type(['.', '5'], 2)).toBe('0.5');
    expect(type(['1', '.', '.', '2'], 2)).toBe('1.2');
  });

  it('stops at nine digits', () => {
    expect(type(['1', '2', '3', '4', '5', '6', '7', '8', '9', '1'])).toBe('123456789');
  });
});
