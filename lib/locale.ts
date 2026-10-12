import 'server-only';
import { getLocale } from 'next-intl/server';

/**
 * The current reader's language for server-side mapping. Outside a request
 * (scripts, jobs, tests) there is no reader, and English is the neutral choice.
 */
export async function requestLocale(): Promise<'en' | 'hi'> {
  try {
    return (await getLocale()) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}
