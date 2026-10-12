import { describe, expect, it } from 'vitest';
import { amountInWords, numberInWords } from './amount-in-words';

describe('numberInWords', () => {
  it.each([
    [0, 'Zero'],
    [7, 'Seven'],
    [19, 'Nineteen'],
    [45, 'Forty Five'],
    [100, 'One Hundred'],
    [1_005, 'One Thousand Five'],
    [120_500, 'One Lakh Twenty Thousand Five Hundred'],
    [12_345_678, 'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight'],
    [1_000_000_000, 'One Hundred Crore'],
  ])('writes %i in the Indian system', (value, words) => {
    expect(numberInWords(value)).toBe(words);
  });

  it('writes Hindi with its own words for every number below 100', () => {
    expect(numberInWords(45, 'hi')).toBe('पैंतालीस');
    expect(numberInWords(99, 'hi')).toBe('निन्यानवे');
    expect(numberInWords(250_000, 'hi')).toBe('दो लाख पचास हज़ार');
  });
});

describe('amountInWords', () => {
  it('adds the currency and paise', () => {
    expect(amountInWords(12_050_050)).toBe(
      'Rupees One Lakh Twenty Thousand Five Hundred and Fifty Paise Only',
    );
    expect(amountInWords(500_000)).toBe('Rupees Five Thousand Only');
  });

  it('does the same in Hindi', () => {
    expect(amountInWords(500_025, 'hi')).toBe('पाँच हज़ार रुपये और पच्चीस पैसे मात्र');
  });
});
