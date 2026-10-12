export const LOCALES = ['en', 'hi'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * One JSON file per area per language, so each feature owns its own strings.
 * Adding a namespace means adding it here and creating both files; the parity
 * test fails if Hindi is missing a key English has.
 */
export const NAMESPACES = [
  'common',
  'nav',
  'auth',
  'errors',
  'validation',
  'dashboard',
  'users',
  'activity',
  'rawMaterials',
  'production',
  'sales',
  'customers',
  'backup',
  'settings',
  'notifications',
  'charts',
  'staff',
  'marketing',
] as const;

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'hi';
}
