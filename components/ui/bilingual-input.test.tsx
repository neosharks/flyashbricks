import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import common from '@/messages/en/common.json';
import { BilingualInput } from './bilingual-input';

function renderInput(props: Partial<React.ComponentProps<typeof BilingualInput>> = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={{ common }} timeZone="Asia/Kolkata">
      <BilingualInput label="Name" name="name" {...props} />
    </NextIntlClientProvider>,
  );
  return {
    english: screen.getByLabelText<HTMLInputElement>(/Name — English/),
    hindi: screen.getByLabelText<HTMLInputElement>(/Name — Hindi/),
  };
}

const type = (input: HTMLInputElement, value: string) =>
  fireEvent.change(input, { target: { value } });

describe('BilingualInput', () => {
  it('fills Hindi from English', () => {
    const { english, hindi } = renderInput();
    type(english, 'Ramesh Singh');
    expect(hindi.value).toBe('रमेश सिंह');
  });

  it('fills English from Hindi when Hindi is typed first', () => {
    const { english, hindi } = renderInput();
    type(hindi, 'रमेश सिंह');
    expect(english.value).toBe('Ramesh Singh');
  });

  it('switches direction after a box is cleared', () => {
    const { english, hindi } = renderInput();
    type(english, 'Ram');
    type(english, '');
    expect(hindi.value).toBe('');
    type(hindi, 'श्याम');
    expect(english.value).toBe('Shyam');
  });

  it('leaves a box alone once someone has typed in it', () => {
    const { english, hindi } = renderInput();
    type(english, 'Ram');
    type(hindi, 'राम जी');
    type(english, 'Ramji');
    expect(hindi.value).toBe('राम जी');
  });

  it('keeps saved values when editing a record', () => {
    const { english, hindi } = renderInput({ defaultEnglish: 'Ram', defaultHindi: 'राम' });
    type(hindi, 'राम कुमार');
    expect(english.value).toBe('Ram');
  });
});
