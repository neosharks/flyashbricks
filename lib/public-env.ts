import { z } from 'zod';

/**
 * Values that are public by definition — never a secret. Each key is referenced
 * explicitly because Next inlines `NEXT_PUBLIC_*` statically;
 * `process.env[dynamicKey]` does not work in the browser.
 *
 * APP_URL is deliberately not `NEXT_PUBLIC_`: it is read when the server
 * starts, so one release build serves any domain. Only server code reads it.
 */
const PublicEnvSchema = z.object({
  APP_URL: z.url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).max(60).default('Fly Ash Bricks'),
});

const parsed = PublicEnvSchema.safeParse({
  APP_URL: process.env.APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
});

if (!parsed.success) {
  throw new Error(
    `Invalid public environment variables:\n${JSON.stringify(z.treeifyError(parsed.error), null, 2)}`,
  );
}

export const publicEnv = parsed.data;
