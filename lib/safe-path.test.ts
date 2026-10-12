import { describe, expect, it } from 'vitest';
import { isSafeAppPath, safeAppPath } from './safe-path';

describe('safeAppPath', () => {
  it.each([
    '/',
    '/sales',
    '/sales/abc?status=due&sort=date',
    '/n/6acc943f58a5684bd8afa90e',
    '/a#b',
  ])('keeps the in-app path %s', (path) => {
    expect(safeAppPath(path)).toBe(path);
    expect(isSafeAppPath(path)).toBe(true);
  });

  it.each([
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    '/\\/evil.com',
    '/\t/evil.com',
    '/\n/evil.com',
    'javascript:alert(1)',
    'evil.com',
    '',
    '/'.padEnd(600, 'a'),
  ])('refuses %j', (path) => {
    expect(safeAppPath(path)).toBe('/');
    expect(isSafeAppPath(path)).toBe(false);
  });

  it('refuses values that are not text', () => {
    expect(safeAppPath({ $ne: null })).toBe('/');
    expect(safeAppPath(undefined, '/sales')).toBe('/sales');
  });
});
