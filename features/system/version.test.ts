// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isNewer, parseVersion } from './version';

describe('release versions', () => {
  it('reads tags and git describe output', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('v0.2.0-3-gabc1234')).toEqual([0, 2, 0]);
    expect(parseVersion('dev')).toBeNull();
    expect(parseVersion('abc1234')).toBeNull();
  });

  it('compares numerically, not as text', () => {
    expect(isNewer('v0.10.0', 'v0.9.9')).toBe(true);
    expect(isNewer('v1.0.0', 'v0.99.99')).toBe(true);
    expect(isNewer('v0.2.1', 'v0.2.0')).toBe(true);
  });

  it('never offers the same or an older release', () => {
    expect(isNewer('v0.2.0', 'v0.2.0')).toBe(false);
    expect(isNewer('v0.2.0', 'v0.2.0-5-gdeadbee')).toBe(false);
    expect(isNewer('v0.1.9', 'v0.2.0')).toBe(false);
  });

  it('lets a build of unknown version move to any release', () => {
    expect(isNewer('v0.2.0', 'dev')).toBe(true);
    expect(isNewer('v0.2.0', '1a2b3c4')).toBe(true);
  });

  it('only accepts plain release tags as the candidate', () => {
    expect(isNewer('v9.9.9-1-gabc1234', 'v0.1.0')).toBe(false);
    expect(isNewer('9.9.9', 'v0.1.0')).toBe(false);
  });
});
