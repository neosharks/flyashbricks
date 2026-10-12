import { z } from 'zod';

/**
 * Values compiled into the browser bundle. Public by definition — never a secret.
 * Each key is referenced explicitly because Next inlines them statically;
 * `process.env[dynamicKey]` does not work in the browser.
 */
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).max(60).default('Fly Ash Bricks'),
});

const parsed = PublicEnvSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
});

if (!parsed.success) {
  throw new Error(
    `Invalid public environment variables:\n${JSON.stringify(z.treeifyError(parsed.error), null, 2)}`,
  );
}

export const publicEnv = parsed.data;
