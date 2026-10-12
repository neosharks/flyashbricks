// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadMessages } from './messages';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

/** Argument names, ignoring the bodies of plural branches like `one {…}`. */
function placeholders(text: string): string[] {
  const names = [...text.matchAll(/(?<!(?:=\d+|zero|one|two|few|many|other)\s?)\{(\w+)(?=[,}])/g)];
  return [...new Set(names.map((match) => match[1] ?? ''))].sort();
}

function leaf(messages: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages);
}

describe('translations', () => {
  it('has every English key in Hindi, and no extras', async () => {
    const [en, hi] = await Promise.all([loadMessages('en'), loadMessages('hi')]);
    expect(keys(hi).sort()).toEqual(keys(en).sort());
  });

  it('uses the same placeholders in both languages', async () => {
    const [en, hi] = await Promise.all([loadMessages('en'), loadMessages('hi')]);
    for (const path of keys(en)) {
      const english = leaf(en, path);
      const hindi = leaf(hi, path);
      if (typeof english === 'string' && typeof hindi === 'string') {
        expect(placeholders(hindi), path).toEqual(placeholders(english));
      }
    }
  });

  it('leaves no string empty', async () => {
    for (const locale of ['en', 'hi'] as const) {
      const messages = await loadMessages(locale);
      for (const path of keys(messages)) {
        expect(String(leaf(messages, path)).trim(), `${locale}:${path}`).not.toBe('');
      }
    }
  });
});
