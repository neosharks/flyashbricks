/**
 * next-intl types every key statically, which is the point. A few keys are
 * data — an error code from the server, an audit action from the database —
 * and can only be checked at runtime. This is the one place that widens the
 * translator for them, and it always pairs `has` with a fallback.
 */
type Translator = { has: (key: never) => boolean };

type DynamicTranslator = {
  has: (key: string) => boolean;
  (key: string, values?: Record<string, string | number>): string;
};

export function translateDynamic(
  t: Translator,
  key: string,
  fallback: string,
  values?: Record<string, string | number>,
): string {
  const loose = t as unknown as DynamicTranslator;
  return loose.has(key) ? loose(key, values) : fallback;
}
