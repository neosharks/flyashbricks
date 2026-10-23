import type { QueryState } from './table-href';

/**
 * The list URL with `open` set to a record (or removed): everything else in
 * the query, paging included, stays, so opening a row never moves the list.
 */
export function panelHref(basePath: string, current: QueryState, id: string | null): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (key !== 'open' && single !== undefined && single !== '') params.set(key, single);
  }
  if (id) params.set('open', id);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** The `open` parameter, when it looks like a record id. */
export function openId(current: QueryState): string | null {
  const raw = Array.isArray(current.open) ? current.open[0] : current.open;
  return raw && /^[a-f\d]{24}$/i.test(raw) ? raw : null;
}
