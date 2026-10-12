import { NAMESPACES, type Locale } from './config';

export type Messages = Record<string, unknown>;

export async function loadMessages(locale: Locale): Promise<Messages> {
  const entries = await Promise.all(
    NAMESPACES.map(async (namespace) => {
      const mod = (await import(`../messages/${locale}/${namespace}.json`)) as {
        default: Messages;
      };
      return [namespace, mod.default] as const;
    }),
  );
  return Object.fromEntries(entries);
}
