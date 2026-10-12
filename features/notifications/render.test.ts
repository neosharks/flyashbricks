import { describe, expect, it } from 'vitest';
import { displayParams } from './render';

const unitLabel = (unit: string) => unit;

describe('displayParams', () => {
  const params = { name: 'Cement', nameHi: 'सीमेंट', customer: 'Ramesh', customerHi: 'रमेश' };

  it('shows Hindi names to a Hindi reader', () => {
    expect(displayParams(params, 'hi', unitLabel)).toMatchObject({
      name: 'सीमेंट',
      customer: 'रमेश',
    });
  });

  it('keeps English names for an English reader', () => {
    expect(displayParams(params, 'en', unitLabel)).toMatchObject({
      name: 'Cement',
      customer: 'Ramesh',
    });
  });

  it('falls back to the stored name when no Hindi was recorded', () => {
    expect(displayParams({ name: 'Cement' }, 'hi', unitLabel).name).toBe('Cement');
  });
});
