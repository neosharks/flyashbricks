import { describe, expect, it } from 'vitest';
import { arrangeMaterials, parseMaterialShow, parseMaterialSort } from './arrange';
import type { MaterialRow } from './types';

const row = (name: string, extra: Partial<MaterialRow> = {}): MaterialRow => ({
  id: name,
  name,
  nameEn: name,
  nameHi: null,
  kind: 'other',
  unit: 'kg',
  quantityMilli: 1_000,
  lowThresholdMilli: 0,
  capacityMilli: null,
  lastRatePaise: null,
  isActive: true,
  level: 'good',
  fill: 0.5,
  dailyUseMilli: null,
  runwayDays: null,
  ...extra,
});

const rows = [
  row('Gypsum', { runwayDays: 40 }),
  row('Cement', { level: 'critical', runwayDays: 2, fill: 0.05 }),
  row('Fly ash', { level: 'warning', runwayDays: 5, fill: 0.2 }),
  row('Old sand', { isActive: false }),
];

describe('arrangeMaterials', () => {
  it('puts what needs ordering first by default', () => {
    const arranged = arrangeMaterials(rows, {
      q: '',
      sort: parseMaterialSort(undefined),
      show: 'active',
    });
    expect(arranged.map((r) => r.name)).toEqual(['Cement', 'Fly ash', 'Gypsum']);
  });

  it('filters to low, inactive or everything', () => {
    expect(arrangeMaterials(rows, { q: '', sort: 'name', show: 'low' }).map((r) => r.name)).toEqual(
      ['Cement', 'Fly ash'],
    );
    expect(
      arrangeMaterials(rows, { q: '', sort: 'name', show: 'inactive' }).map((r) => r.name),
    ).toEqual(['Old sand']);
    expect(arrangeMaterials(rows, { q: '', sort: 'name', show: 'all' })).toHaveLength(4);
  });

  it('searches by name and sorts unknown runways last', () => {
    expect(
      arrangeMaterials(rows, { q: 'ASH', sort: 'name', show: 'active' }).map((r) => r.name),
    ).toEqual(['Fly ash']);
    const byDays = arrangeMaterials([...rows, row('Lime')], {
      q: '',
      sort: 'daysLeft',
      show: 'active',
    });
    expect(byDays.at(-1)?.name).toBe('Lime');
  });

  it('defaults unknown query values', () => {
    expect(parseMaterialShow('everything')).toBe('active');
    expect(parseMaterialSort('price')).toBe('level');
  });
});
