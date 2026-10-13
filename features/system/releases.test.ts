// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLatestRelease } from './releases';

const RELEASE = {
  tag_name: 'v0.3.0',
  name: '',
  html_url: 'https://github.com/neosharks/flyashbricks/releases/tag/v0.3.0',
  body: '- feat: something new',
  published_at: '2026-10-13T08:00:00Z',
};

function respond(status: number, body: unknown = {}) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body, { status }));
}

describe('latest release', () => {
  afterEach(() => vi.restoreAllMocks());

  it('maps the newest GitHub release, naming it after the tag when unnamed', async () => {
    const fetchMock = respond(200, RELEASE);
    expect(await fetchLatestRelease('neosharks/flyashbricks')).toEqual({
      version: 'v0.3.0',
      name: 'v0.3.0',
      url: RELEASE.html_url,
      notes: '- feat: something new',
      publishedAt: '2026-10-13T08:00:00Z',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/neosharks/flyashbricks/releases/latest',
      expect.objectContaining({ redirect: 'error' }),
    );
  });

  it('has nothing to offer before the first release', async () => {
    respond(404);
    expect(await fetchLatestRelease('neosharks/flyashbricks')).toBeNull();
  });

  it('ignores releases that are not plain version tags or link away from GitHub', async () => {
    respond(200, { ...RELEASE, tag_name: 'nightly' });
    expect(await fetchLatestRelease('neosharks/flyashbricks')).toBeNull();
    respond(200, { ...RELEASE, html_url: 'https://evil.example/release' });
    expect(await fetchLatestRelease('neosharks/flyashbricks')).toBeNull();
  });

  it('treats an unreachable GitHub as unknown rather than failing the page', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    expect(await fetchLatestRelease('neosharks/flyashbricks')).toBeNull();
  });
});
