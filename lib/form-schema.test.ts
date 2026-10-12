import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  checkbox,
  count,
  optionalText,
  phone,
  quantity,
  rupees,
  rupeesOrZero,
} from './form-schema';

describe('rupees', () => {
  it('turns typed rupees into integer paise without floating point', () => {
    expect(rupees().parse('1,250.50')).toBe(125_050);
    expect(rupees().parse('0.1')).toBe(10);
    expect(rupees().parse('7')).toBe(700);
  });

  it('rejects text, negative numbers and a third decimal place', () => {
    for (const bad of ['abc', '-5', '1.234']) {
      expect(rupees().safeParse(bad).success, bad).toBe(false);
    }
  });

  it('treats blank as missing, or as zero where that is allowed', () => {
    expect(rupees().safeParse('').success).toBe(false);
    expect(rupeesOrZero().parse('')).toBe(0);
  });
});

describe('quantity', () => {
  it('stores thousandths of a unit as an integer', () => {
    expect(quantity().parse('1250.5')).toBe(1_250_500);
    expect(quantity().parse('0.001')).toBe(1);
  });

  it('enforces a minimum', () => {
    expect(quantity({ min: 1 }).safeParse('0').success).toBe(false);
  });
});

describe('count', () => {
  it('accepts grouped digits and enforces bounds', () => {
    expect(count({ min: 1, max: 100_000 }).parse('12,000')).toBe(12_000);
    expect(count({ min: 1, max: 10 }).safeParse('11').success).toBe(false);
    expect(count({ min: 1, max: 10 }).safeParse('2.5').success).toBe(false);
  });
});

describe('form semantics', () => {
  it('reads an absent checkbox as false', () => {
    const schema = z.object({ flag: checkbox() });
    expect(schema.parse({}).flag).toBe(false);
    expect(schema.parse({ flag: 'on' }).flag).toBe(true);
  });

  it('turns blank optional text into null', () => {
    expect(optionalText(10).parse('   ')).toBeNull();
    expect(optionalText(10).parse(' hi ')).toBe('hi');
  });

  it('normalises phone numbers and keys the error for translation', () => {
    expect(phone().parse('+91 98765 43210')).toBe('9876543210');
    const result = phone().safeParse('123');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('invalidPhone');
  });
});
