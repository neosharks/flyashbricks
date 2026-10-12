'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { isEnglishText, isHindiText } from '@/lib/script';
import { toEnglish, toHindi } from '@/lib/transliterate';
import { Field } from './field';
import { Input } from './input';

type Side = 'en' | 'hi';

/**
 * One value in two scripts: an English box and a Hindi box, clearly labelled,
 * the reader's own language first.
 *
 * Typing in either box fills the other with a suggested spelling, in both
 * directions, whenever the other box is empty or still holds a suggestion.
 * Once someone types in it themselves it is left alone (until it is emptied
 * again). Text in the wrong script is flagged as it is typed; the server
 * checks the same rule.
 */
export function BilingualInput({
  label,
  name,
  defaultEnglish,
  defaultHindi,
  required = false,
  maxLength,
  errors,
  autoComplete = 'off',
}: {
  /** The field's label in the current language, e.g. "Name" / "नाम". */
  label: string;
  /** Form field base: posts `<name>` (English) and `<name>Hi` (Hindi). */
  name: string;
  defaultEnglish?: string | null | undefined;
  defaultHindi?: string | null | undefined;
  required?: boolean | undefined;
  maxLength?: number | undefined;
  /** Server errors for each side, already translated. */
  errors?: { en?: string | undefined; hi?: string | undefined } | undefined;
  autoComplete?: string | undefined;
}) {
  const t = useTranslations('common.bilingual');
  const locale = useLocale();
  const [values, setValues] = useState({ en: defaultEnglish ?? '', hi: defaultHindi ?? '' });
  /** The box currently holding a suggested spelling rather than typed text. */
  const [suggested, setSuggested] = useState<Side | null>(null);

  function change(side: Side, text: string): void {
    const other: Side = side === 'en' ? 'hi' : 'en';
    const next = { ...values, [side]: text };
    let nextSuggested = suggested === side ? null : suggested;

    const otherIsFree = values[other].trim() === '' || suggested === other;
    const valid = side === 'en' ? isEnglishText(text) : isHindiText(text) || text === '';
    if (otherIsFree && valid) {
      next[other] = side === 'en' ? toHindi(text) : toEnglish(text);
      nextSuggested = text.trim() ? other : null;
    }

    setValues(next);
    setSuggested(nextSuggested);
  }

  const liveError = (side: Side): string | undefined => {
    const text = values[side].trim();
    if (!text) return undefined;
    if (side === 'en' && !isEnglishText(text)) return t('wrongScriptEnglish');
    if (side === 'hi' && !isHindiText(text)) return t('wrongScriptHindi');
    return undefined;
  };

  const order: Side[] = locale === 'hi' ? ['hi', 'en'] : ['en', 'hi'];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {order.map((side) => (
        <Field
          key={side}
          label={side === 'en' ? t('english', { label }) : t('hindi', { label })}
          // Only the first box is marked required: filling either one is enough.
          required={required && side === order[0]}
          error={liveError(side) ?? errors?.[side]}
          hint={suggested === side ? t('suggested') : undefined}
        >
          {(props) => (
            <div className="relative">
              <Input
                {...props}
                name={side === 'en' ? name : `${name}Hi`}
                lang={side}
                value={values[side]}
                maxLength={maxLength}
                autoComplete={autoComplete}
                onChange={(event) => change(side, event.target.value)}
                className={suggested === side ? 'bg-action-subtle/40 pr-9' : 'pr-9'}
              />
              <span
                aria-hidden
                className="text-foreground-subtle pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold"
              >
                {side === 'en' ? 'EN' : 'हि'}
              </span>
            </div>
          )}
        </Field>
      ))}
    </div>
  );
}
