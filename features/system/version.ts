/**
 * Release versions are git tags `vMAJOR.MINOR.PATCH`. A server built from a
 * commit after a tag reports `git describe` output such as `v0.2.0-3-gabc1234`,
 * which still counts as that release for deciding whether an update is newer.
 */
export const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

const DESCRIBED = /^v(\d+)\.(\d+)\.(\d+)(?:-\d+-g[0-9a-f]+)?$/;

type Parts = [number, number, number];

export function parseVersion(version: string): Parts | null {
  const match = DESCRIBED.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Whether `candidate` (a release tag) is newer than what runs now. Unknown builds can always update. */
export function isNewer(candidate: string, current: string): boolean {
  const next = RELEASE_TAG.test(candidate) ? parseVersion(candidate) : null;
  if (!next) return false;
  const now = parseVersion(current);
  if (!now) return true;
  for (const [i, part] of next.entries()) {
    const other = now[i] ?? 0;
    if (part !== other) return part > other;
  }
  return false;
}
