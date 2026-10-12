import { z } from 'zod';
import { isEnglishText, isHindiText } from './script';
import { toEnglish, toHindi } from './transliterate';

/**
 * Names are kept in both scripts: `name` in English (Latin letters, also the
 * sort key) and `nameHi` in Hindi (Devanagari). Each reader sees their own
 * language, falling back to the other when one is missing.
 */
/** Trimmed text, or null when there is nothing but whitespace. */
function filled(text: string | null | undefined): string | null {
  const trimmed = text?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function pickText(
  english: string | null | undefined,
  hindi: string | null | undefined,
  locale: string,
): string {
  const preferred = locale === 'hi' ? hindi : english;
  const other = locale === 'hi' ? english : hindi;
  return filled(preferred) ?? filled(other) ?? '';
}

/** Either side may be left empty; the other is filled from it by transliteration. */
export function completeBilingual(english: string | null, hindi: string | null) {
  const en = filled(english);
  const hi = filled(hindi);
  return {
    en: en ?? (hi ? toEnglish(hi) : null),
    hi: hi ?? (en ? toHindi(en) : null),
  };
}

const blankToNull = (value: unknown) =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : (value ?? null);

/**
 * A two-script field pair for a form: `<base>` (English) and `<base>Hi`
 * (Hindi). Each side is checked for its script — Hindi typed into the English
 * box, or the other way round, is an error on that box. At least one side is
 * required when `required`; the empty side is filled automatically.
 */
export function bilingualFields<Base extends string>(
  base: Base,
  options: { max: number; required: boolean; min?: number },
) {
  const side = (check: (text: string) => boolean, message: string) =>
    z.preprocess(
      blankToNull,
      z
        .string()
        .max(options.max, 'tooBig')
        .refine((text) => text.length >= (options.min ?? 1), 'tooSmall')
        .refine(check, message)
        .nullable(),
    );

  return {
    shape: {
      [base]: side(isEnglishText, 'mustBeEnglish'),
      [`${base}Hi`]: side(isHindiText, 'mustBeHindi'),
    } as unknown as Record<Base | `${Base}Hi`, z.ZodType<string | null>>,
    /** Use in the object's `superRefine`: one side is needed when the field is required. */
    requireOne(value: Record<string, unknown>, ctx: z.RefinementCtx) {
      if (options.required && !value[base] && !value[`${base}Hi`]) {
        ctx.addIssue({ code: 'custom', path: [base], message: 'required' });
      }
    },
    /** Use in the object's `transform`: fills the empty side. */
    complete(value: Record<string, unknown>) {
      const filled = completeBilingual(
        (value[base] as string | null) ?? null,
        (value[`${base}Hi`] as string | null) ?? null,
      );
      return { [base]: filled.en, [`${base}Hi`]: filled.hi } as Record<
        Base | `${Base}Hi`,
        string | null
      >;
    },
  };
}
