import { describe, expect, it } from 'vitest';
import { parseSalesFilters, resolveRange } from './filters';

const TZ = 'Asia/Kolkata';
// 20:00 UTC on 12 Oct is already 13 Oct (01:30) in India.
const NOW = new Date('2026-10-12T20:00:00Z');

describe('resolveRange', () => {
  it('uses the yard’s calendar, not the server’s', () => {
    expect(resolveRange('today', { from: null, to: null }, TZ, NOW)).toEqual({
      from: '2026-10-13',
      to: '2026-10-13',
    });
  });

  it.each([
    ['week', '2026-10-12', '2026-10-13'],
    ['month', '2026-10-01', '2026-10-13'],
    ['lastMonth', '2026-09-01', '2026-09-30'],
    ['last30', '2026-09-14', '2026-10-13'],
  ] as const)('%s runs %s to %s', (range, from, to) => {
    expect(resolveRange(range, { from: null, to: null }, TZ, NOW)).toEqual({ from, to });
  });

  it('swaps a custom range entered back to front', () => {
    expect(resolveRange('custom', { from: '2026-10-10', to: '2026-10-01' }, TZ, NOW)).toEqual({
      from: '2026-10-01',
      to: '2026-10-10',
    });
  });
});

describe('parseSalesFilters', () => {
  it('ignores values it does not recognise rather than failing the page', () => {
    expect(
      parseSalesFilters(
        { range: 'forever', status: 'lost', customer: 'x', from: 'soon', product: 'y', rate: '-5' },
        TZ,
        NOW,
      ),
    ).toEqual({
      range: null,
      from: null,
      to: null,
      status: null,
      customerId: null,
      productId: null,
      rateBand: null,
    });
  });

  it('reads a custom range and a customer', () => {
    expect(
      parseSalesFilters(
        {
          range: 'custom',
          from: '2026-10-01',
          to: '2026-10-05',
          status: 'due',
          customer: '64b7f0c2a1b2c3d4e5f60718',
        },
        TZ,
        NOW,
      ),
    ).toEqual({
      range: 'custom',
      from: '2026-10-01',
      to: '2026-10-05',
      status: 'due',
      customerId: '64b7f0c2a1b2c3d4e5f60718',
      productId: null,
      rateBand: null,
    });
  });

  it('reads a brick type and a price band from a group link', () => {
    const filters = parseSalesFilters(
      { product: '64b7f0c2a1b2c3d4e5f60719', rate: '625' },
      TZ,
      NOW,
    );
    expect(filters.productId).toBe('64b7f0c2a1b2c3d4e5f60719');
    expect(filters.rateBand).toBe(625);
  });
});
