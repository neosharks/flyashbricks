import { describe, expect, it } from 'vitest';
import { openId, panelHref } from './panel-href';

describe('panelHref', () => {
  it('keeps the list where it is and sets the open record', () => {
    expect(panelHref('/sales', { status: 'due', after: 'abc', open: 'old' }, 'a'.repeat(24))).toBe(
      `/sales?status=due&after=abc&open=${'a'.repeat(24)}`,
    );
  });

  it('closes the panel without touching the rest', () => {
    expect(panelHref('/sales', { q: 'ram', open: 'x' }, null)).toBe('/sales?q=ram');
    expect(panelHref('/sales', { open: 'x' }, null)).toBe('/sales');
  });
});

describe('openId', () => {
  it('accepts only a record id', () => {
    expect(openId({ open: 'f'.repeat(24) })).toBe('f'.repeat(24));
    expect(openId({ open: '../users' })).toBeNull();
    expect(openId({})).toBeNull();
  });
});
