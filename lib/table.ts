import { z } from 'zod';
import type { Model, QueryFilter } from '@/lib/mongoose';
import { Types, type ObjectId } from '@/lib/mongoose';

/**
 * Sortable, searchable, paginated tables.
 *
 * Every table's state lives in the URL (`?q=&sort=&dir=&after=&size=`), so a
 * filtered view is shareable and survives refresh and the back button.
 *
 * Paging is keyset, never `skip()`: the cursor carries the last row's sort
 * value plus its `_id` as a tiebreaker. `skip()` scans and discards every
 * earlier row and loses or repeats rows when writes land between pages.
 */
export const PAGE_SIZES = [10, 25, 50] as const;

export type SortDir = 'asc' | 'desc';

export type TableParams<S extends string> = {
  q: string;
  sort: S;
  dir: SortDir;
  after: string | null;
  before: string | null;
  size: number;
};

const RawParamsSchema = z.object({
  q: z.string().trim().max(80).catch(''),
  sort: z.string().max(40).optional().catch(undefined),
  dir: z.enum(['asc', 'desc']).optional().catch(undefined),
  after: z.string().max(300).optional().catch(undefined),
  before: z.string().max(300).optional().catch(undefined),
  size: z.coerce
    .number()
    .refine((value) => (PAGE_SIZES as readonly number[]).includes(value))
    .optional()
    .catch(undefined),
});

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Anything malformed falls back to the default rather than erroring the page.
 *
 * `prefix` lets one page hold several independent tables (`?sales_sort=…`
 * next to `?pay_sort=…`), each with its own sort, search and cursor.
 */
export function parseTableParams<S extends string>(
  searchParams: SearchParams,
  sorts: readonly S[],
  defaults: { sort: S; dir: SortDir; size?: number },
  prefix = '',
): TableParams<S> {
  const read = (key: string) => first(searchParams[`${prefix}${key}`]);
  const raw = RawParamsSchema.parse({
    q: read('q') ?? '',
    sort: read('sort'),
    dir: read('dir'),
    after: read('after'),
    before: read('before'),
    size: read('size'),
  });

  const sort = sorts.find((candidate) => candidate === raw.sort) ?? defaults.sort;
  return {
    q: raw.q,
    sort,
    dir: raw.dir ?? (sort === defaults.sort ? defaults.dir : 'asc'),
    after: raw.after ?? null,
    before: raw.after ? null : (raw.before ?? null),
    size: raw.size ?? defaults.size ?? 25,
  };
}

type CursorValue = string | number | Date;
type Cursor = { v: CursorValue; id: string };

export function encodeCursor(value: CursorValue, id: string): string {
  const v = value instanceof Date ? { d: value.toISOString() } : value;
  return Buffer.from(JSON.stringify({ v, id }), 'utf8').toString('base64url');
}

const CursorSchema = z.object({
  v: z.union([z.string().max(200), z.number(), z.object({ d: z.iso.datetime() })]),
  id: z.string().regex(/^[a-f\d]{24}$/i),
});

export function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = CursorSchema.safeParse(
      JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')),
    );
    if (!parsed.success) return null;
    const { v, id } = parsed.data;
    return { v: typeof v === 'object' ? new Date(v.d) : v, id };
  } catch {
    // A tampered or truncated cursor is a bad link, not a crash: start over.
    return null;
  }
}

/**
 * The filter selecting rows strictly after `cursor` in the given order.
 * Exported for tests; `keysetPage` is the only production caller.
 */
export function keysetFilter(field: string, ascending: boolean, cursor: Cursor) {
  const op = ascending ? '$gt' : '$lt';
  const id = new Types.ObjectId(cursor.id);
  return {
    $or: [{ [field]: { [op]: cursor.v } }, { [field]: cursor.v, _id: { [op]: id } }],
  };
}

export type Page<T> = {
  rows: T[];
  /** Pass as `after` for the next page; null on the last page. */
  next: string | null;
  /** Pass as `before` for the previous page; null on the first page. */
  prev: string | null;
};

/**
 * One page of `model` matching `filter`, ordered by `field` then `_id`.
 * The sort field must never be null or missing on a document — a null sorts
 * before every value and cannot be compared, so the cursor would skip it.
 */
export async function keysetPage<Doc extends { _id: ObjectId }>(
  model: Model<Doc>,
  filter: QueryFilter<Doc>,
  params: { sort: string; dir: SortDir; after: string | null; before: string | null; size: number },
): Promise<Page<Doc>> {
  const ascending = params.dir === 'asc';
  const after = decodeCursor(params.after);
  const before = after ? null : decodeCursor(params.before);

  // Paging backwards walks the reverse order, then flips the rows back.
  const walkAscending = before ? !ascending : ascending;
  const cursor = after ?? before;
  const query: QueryFilter<Doc> = cursor
    ? { $and: [filter, keysetFilter(params.sort, walkAscending, cursor)] }
    : filter;

  const direction = walkAscending ? 1 : -1;
  const found = await model
    .find(query)
    .sort({ [params.sort]: direction, _id: direction })
    .limit(params.size + 1)
    .maxTimeMS(5_000)
    .lean<Doc[]>();

  const hasMore = found.length > params.size;
  const rows = hasMore ? found.slice(0, params.size) : found;
  if (before) rows.reverse();

  const cursorOf = (doc: Doc | undefined): string | null => {
    if (!doc) return null;
    const value = (doc as Record<string, unknown>)[params.sort] as CursorValue;
    return encodeCursor(value, doc._id.toString());
  };

  return {
    rows,
    next: before ? cursorOf(rows.at(-1)) : hasMore ? cursorOf(rows.at(-1)) : null,
    prev: before ? (hasMore ? cursorOf(rows[0]) : null) : after ? cursorOf(rows[0]) : null,
  };
}
