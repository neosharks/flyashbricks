import 'server-only';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { RELEASE_TAG } from './version';

const ReleaseSchema = z.object({
  tag_name: z.string().regex(RELEASE_TAG),
  // GitHub sends an empty name when a release was published without one.
  name: z.string().trim().min(1).nullish().catch(null),
  // Linked from the page, so only ever to GitHub itself.
  html_url: z.url().startsWith('https://github.com/'),
  body: z.string().nullish(),
  published_at: z.string().nullish(),
});

export type Release = {
  version: string;
  name: string;
  url: string;
  /** Release notes as plain text (Markdown source); never rendered as HTML. */
  notes: string;
  publishedAt: string | null;
};

/** Notes beyond this are cut; the full text is one click away on GitHub. */
const MAX_NOTES = 8000;

/**
 * The newest published release of `repo`, or null when GitHub cannot be
 * reached or answers with something unexpected. Cached for an hour unless
 * `fresh` is set, which the update action uses so it never installs a release
 * that has since been replaced.
 */
export async function fetchLatestRelease(
  repo: string,
  options: { fresh?: boolean } = {},
): Promise<Release | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'fly-ash-bricks' },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      ...(options.fresh ? { cache: 'no-store' as const } : { next: { revalidate: 3600 } }),
    });
    // No release published yet.
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub answered ${response.status}`);

    const release = ReleaseSchema.parse(await response.json());
    return {
      version: release.tag_name,
      name: release.name ?? release.tag_name,
      url: release.html_url,
      notes: (release.body ?? '').slice(0, MAX_NOTES),
      publishedAt: release.published_at ?? null,
    };
  } catch (err) {
    logger.warn({ err, repo }, 'could not check for a new release');
    return null;
  }
}
