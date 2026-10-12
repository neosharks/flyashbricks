/**
 * Which script a piece of text is written in — for checking that the English
 * box holds English (Latin letters) and the Hindi box holds Hindi
 * (Devanagari). Digits, punctuation and spaces are fine in either.
 */
const DEVANAGARI = /[ऀ-ॿ]/;
const LATIN_LETTER = /[A-Za-z]/;

export function hasDevanagari(text: string): boolean {
  return DEVANAGARI.test(text);
}

/** English text: no Devanagari at all. */
export function isEnglishText(text: string): boolean {
  return !hasDevanagari(text);
}

/**
 * Hindi text: some Devanagari, and Latin letters only as short all-caps
 * codes that are written that way in Hindi too — "सीमेंट (OPC 43)", "GST".
 * A lowercase English word in the Hindi box is a mistake worth flagging.
 */
export function isHindiText(text: string): boolean {
  if (!hasDevanagari(text)) return false;
  const latinWords = text.split(/[^A-Za-z]+/).filter((word) => LATIN_LETTER.test(word));
  return latinWords.every((word) => word.length <= 6 && word === word.toUpperCase());
}
