// @vitest-environment node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A form that is handled by JavaScript falls back to the browser's default
 * when the script has not loaded (slow network, blocked script): a GET that
 * puts every field — passwords included — into the address bar and history.
 * Every form that submits data must say `method="post"` so that can never
 * happen. Search and filter forms are the exception: their values belong in
 * the URL, and they are marked `role="search"` or contain only date filters.
 */
async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(full)));
    else if (full.endsWith('.tsx')) files.push(full);
  }
  return files;
}

describe('forms', () => {
  it('send data with POST, so nothing typed ever ends up in a URL', async () => {
    const files = [...(await sourceFiles('components')), ...(await sourceFiles('app'))];
    const offenders: string[] = [];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(/<form\b([^>]*)>/gs)) {
        const attributes = match[1] ?? '';
        const posts = attributes.includes('method="post"');
        const isFilter =
          attributes.includes('role="search"') ||
          !/onSubmit=\{form\.onSubmit\}|submit\(/.test(attributes);
        if (!posts && !isFilter) offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
