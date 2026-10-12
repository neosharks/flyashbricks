import { describe, expect, it } from 'vitest';
import { parseDayRange } from './range';

const today = '2026-10-12';

describe('parseDayRange', () => {
  it('defaults to the last 30 days, inclusive of today', () => {
    expect(parseDayRange({}, today)).toEqual({ preset: '30d', from: '2026-09-13', to: today });
  });

  it('reads presets', () => {
    expect(parseDayRange({ range: 'today' }, today)).toEqual({
      preset: 'today',
      from: today,
      to: today,
    });
    expect(parseDayRange({ range: 'month' }, today).from).toBe('2026-10-01');
    expect(parseDayRange({ range: 'all' }, today)).toEqual({ preset: 'all', from: null, to: null });
  });

  it('reads a custom range and swaps one entered backwards', () => {
    expect(parseDayRange({ range: 'custom', from: '2026-10-05', to: '2026-10-01' }, today)).toEqual(
      {
        preset: 'custom',
        from: '2026-10-01',
        to: '2026-10-05',
      },
    );
  });

  it('ignores junk and falls back', () => {
    expect(parseDayRange({ range: 'forever' }, today).preset).toBe('30d');
    expect(parseDayRange({ range: 'custom', from: 'yesterday' }, today).preset).toBe('30d');
  });
});
