/**
 * Builds a table URL from the current query plus overrides. `null` removes a
 * key. Changing anything but the page cursor resets paging, because a cursor
 * from one sort order or search is meaningless in another.
 */
export type QueryState = Record<string, string | string[] | undefined>;

export function tableHref(
  basePath: string,
  current: QueryState,
  overrides: Record<string, string | null>,
  /** The table's parameter prefix; only that table's cursor is reset. */
  prefix = '',
): string {
  const after = `${prefix}after`;
  const before = `${prefix}before`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single !== undefined && single !== '') params.set(key, single);
  }

  const pagingOnly = Object.keys(overrides).every((key) => key === after || key === before);
  if (!pagingOnly) {
    params.delete(after);
    params.delete(before);
  }
  // `after` and `before` are mutually exclusive.
  if (after in overrides) params.delete(before);
  if (before in overrides) params.delete(after);

  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === '') params.delete(key);
    else params.set(key, value);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
