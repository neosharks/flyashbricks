import { describe, expect, it } from 'vitest';
import { tableHref } from './table-href';

describe('tableHref', () => {
  it('keeps the current query and applies overrides', () => {
    expect(tableHref('/sales', { q: 'ram', status: 'paid' }, { sort: 'total' })).toBe(
      '/sales?q=ram&status=paid&sort=total',
    );
  });

  it('resets paging when the sort or search changes', () => {
    expect(tableHref('/sales', { q: 'ram', after: 'abc' }, { q: 'shyam' })).toBe('/sales?q=shyam');
  });

  it('keeps filters but swaps the cursor when paging', () => {
    expect(tableHref('/sales', { q: 'ram', after: 'abc' }, { before: 'xyz' })).toBe(
      '/sales?q=ram&before=xyz',
    );
  });

  it('removes a key set to null', () => {
    expect(tableHref('/sales', { q: 'ram', status: 'paid' }, { status: null })).toBe(
      '/sales?q=ram',
    );
  });

  it('returns the bare path when nothing is left', () => {
    expect(tableHref('/sales', { q: 'ram' }, { q: null })).toBe('/sales');
  });

  it('pages one prefixed table without disturbing another on the same page', () => {
    expect(
      tableHref('/customers/1', { sales_after: 'a', pay_after: 'b' }, { pay_before: 'c' }, 'pay_'),
    ).toBe('/customers/1?sales_after=a&pay_before=c');
  });

  it('resets only its own cursor when its sort changes', () => {
    expect(
      tableHref(
        '/customers/1',
        { sales_after: 'a', pay_after: 'b' },
        { pay_sort: 'amount' },
        'pay_',
      ),
    ).toBe('/customers/1?sales_after=a&pay_sort=amount');
  });
});
