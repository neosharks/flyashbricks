import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fieldErrors, formDataToObject } from './action';

describe('formDataToObject', () => {
  it('converts plain fields to a parseable object', () => {
    const form = new FormData();
    form.set('name', 'Asha');
    form.set('phone', '9876543210');

    expect(formDataToObject(form)).toEqual({ name: 'Asha', phone: '9876543210' });
  });

  it("drops React's internal action fields", () => {
    const form = new FormData();
    form.set('name', 'Asha');
    form.set('$ACTION_ID_7f3c', '1');
    form.set('$ACTION_REF_1', '');

    expect(formDataToObject(form)).toEqual({ name: 'Asha' });
  });

  it('collects repeated fields into an array', () => {
    const form = new FormData();
    form.append('phone', 'a');
    form.append('phone', 'b');

    expect(formDataToObject(form)).toEqual({ phone: ['a', 'b'] });
  });

  it('ignores file entries, which never belong in a schema', () => {
    const form = new FormData();
    form.set('title', 'Photo');
    form.set('upload', new File(['x'], 'x.png', { type: 'image/png' }));

    expect(formDataToObject(form)).toEqual({ title: 'Photo' });
  });
});

describe('fieldErrors', () => {
  const schema = z
    .object({
      name: z.string().min(1),
      age: z.number().max(10),
      password: z.string().min(10, 'passwordTooShort'),
      lines: z.array(z.object({ qty: z.number().min(1) })),
    })
    .strict();

  it('turns each issue into a translation key on its field path', () => {
    const result = schema.safeParse({
      name: '',
      age: 12,
      password: 'short',
      lines: [{ qty: 0 }],
    });
    if (result.success) throw new Error('expected failure');

    expect(fieldErrors(result.error)).toEqual({
      name: ['required'],
      age: ['tooBig'],
      password: ['passwordTooShort'],
      'lines.0.qty': ['tooSmall'],
    });
  });

  it('reports unknown keys against the form as a whole', () => {
    const result = z.object({}).strict().safeParse({ extra: 1 });
    if (result.success) throw new Error('expected failure');

    expect(Object.keys(fieldErrors(result.error))).toEqual(['_form']);
  });
});
