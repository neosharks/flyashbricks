import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { bilingualFields, completeBilingual, pickText } from './bilingual';

const nameField = bilingualFields('name', { max: 120, required: true, min: 2 });
const Schema = z
  .object({ ...nameField.shape })
  .strict()
  .superRefine((value, ctx) => nameField.requireOne(value, ctx))
  .transform((value) => ({ ...value, ...nameField.complete(value) }));

describe('bilingual name fields', () => {
  it('fills Hindi from English and English from Hindi', () => {
    expect(Schema.parse({ name: 'Ramesh Kumar', nameHi: '' })).toEqual({
      name: 'Ramesh Kumar',
      nameHi: 'रमेश कुमार',
    });
    expect(Schema.parse({ name: '', nameHi: 'रमेश' })).toEqual({ name: 'Ramesh', nameHi: 'रमेश' });
  });

  it('keeps both when both are typed', () => {
    expect(Schema.parse({ name: 'Ram', nameHi: 'राम' })).toEqual({ name: 'Ram', nameHi: 'राम' });
  });

  it('flags Hindi in the English box and English in the Hindi box', () => {
    const wrong = Schema.safeParse({ name: 'रमेश', nameHi: 'Ramesh' });
    expect(wrong.success).toBe(false);
    const messages = wrong.error?.issues.map((issue) => `${issue.path.join('.')}:${issue.message}`);
    expect(messages).toEqual(expect.arrayContaining(['name:mustBeEnglish', 'nameHi:mustBeHindi']));
  });

  it('needs at least one of the two', () => {
    expect(Schema.safeParse({ name: '', nameHi: '' }).success).toBe(false);
  });
});

describe('pickText', () => {
  it('shows each reader their language, falling back to the other', () => {
    expect(pickText('Ramesh', 'रमेश', 'hi')).toBe('रमेश');
    expect(pickText('Ramesh', 'रमेश', 'en')).toBe('Ramesh');
    expect(pickText('Ramesh', null, 'hi')).toBe('Ramesh');
    expect(pickText(null, 'रमेश', 'en')).toBe('रमेश');
  });

  it('completeBilingual leaves nothing empty when one side exists', () => {
    expect(completeBilingual(null, null)).toEqual({ en: null, hi: null });
    expect(completeBilingual('Fly ash', null).hi).toBe('फ्लाई ऐश');
  });
});
