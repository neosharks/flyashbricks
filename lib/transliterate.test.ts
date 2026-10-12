import { describe, expect, it } from 'vitest';
import { isEnglishText, isHindiText } from './script';
import { toEnglish, toHindi } from './transliterate';

describe('toHindi', () => {
  it.each([
    ['Ramesh Kumar', 'रमेश कुमार'],
    ['Suresh Meena', 'सुरेश मीणा'],
    ['Sharma Builders', 'शर्मा बिल्डर्स'],
    ['Vikram Singh', 'विक्रम सिंह'],
    ['Pooja Saini', 'पूजा सैनी'],
    ['Dinesh', 'दिनेश'],
    ['Fly ash', 'फ्लाई ऐश'],
    ['Cement (OPC 43)', 'सीमेंट (OPC 43)'],
    ['Ghaziabad', 'ग़ाज़ियाबाद'],
    ['Greater Noida', 'ग्रेटर नोएडा'],
    ['Meerut', 'मेरठ'],
  ])('spells %s as %s', (english, hindi) => {
    expect(toHindi(english)).toBe(hindi);
  });

  it('always produces text the Hindi box accepts', () => {
    for (const name of ['Mahesh Yadav', 'Kailash Jat', 'Gupta Construction', 'Bassi', 'Chomu']) {
      expect(isHindiText(toHindi(name)), name).toBe(true);
    }
  });
});

describe('toEnglish', () => {
  it.each([
    ['रमेश', 'Ramesh'],
    ['राम', 'Ram'],
    ['सिंह', 'Singh'],
    ['शर्मा बिल्डर्स', 'Sharma Builders'],
    ['दिनेश सैनी', 'Dinesh Saini'],
    ['सीमेंट (OPC 43)', 'Cement (OPC 43)'],
  ])('spells %s as %s', (hindi, english) => {
    expect(toEnglish(hindi)).toBe(english);
  });

  it('always produces text the English box accepts', () => {
    for (const name of ['महेश यादव', 'कैलाश', 'गणेश ब्रिक्स', 'चूना']) {
      expect(isEnglishText(toEnglish(name)), name).toBe(true);
    }
  });
});

describe('script checks', () => {
  it('accepts each script only in its own box', () => {
    expect(isEnglishText('Ramesh Kumar')).toBe(true);
    expect(isEnglishText('रमेश')).toBe(false);
    expect(isHindiText('रमेश कुमार')).toBe(true);
    expect(isHindiText('Ramesh')).toBe(false);
  });

  it('allows short capital codes inside Hindi, but not English words', () => {
    expect(isHindiText('सीमेंट (OPC 43)')).toBe(true);
    expect(isHindiText('रमेश kumar')).toBe(false);
  });
});
