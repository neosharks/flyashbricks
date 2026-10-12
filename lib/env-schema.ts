import { z } from 'zod';

/**
 * The server environment contract, kept separate from `lib/env.ts` so that
 * scripts and the migration runner can validate configuration without pulling
 * in the `server-only` module graph.
 */
const ServerEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    MONGODB_URI: z.string().startsWith('mongodb'),
    MONGODB_DB_NAME: z.string().min(1).default('flyash'),

    AUTH_SECRET: z.string().min(32),
    AUTH_URL: z.url().optional(),
    AUTH_TRUST_HOST: z.stringbool().default(false),

    REDIS_URL: z.string().startsWith('redis').optional(),

    MAIL_TRANSPORT: z.enum(['console', 'smtp']).default('console'),
    MAIL_FROM: z.email().default('alerts@example.com'),
    SMTP_URL: z.string().optional(),

    CRON_SECRET: z.string().min(16),

    LOG_LEVEL: z
      .enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),

    /**
     * Scheduled backups (/api/cron/backup). Without a passphrase the job does
     * nothing: a backup is never written or sent unencrypted.
     */
    BACKUP_PASSPHRASE: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(16).optional(),
    ),
    /** Directory for scheduled backup files; ideally a separate disk or a mounted share. */
    BACKUP_DIR: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),
    BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(30),
    /** Comma-separated addresses that receive each scheduled backup by email. */
    BACKUP_EMAIL_TO: z
      .string()
      .optional()
      .transform((value) =>
        (value ?? '')
          .split(',')
          .map((address) => address.trim().toLowerCase())
          .filter(Boolean),
      )
      .pipe(z.array(z.email()).max(10)),

    /**
     * SMS and WhatsApp go out through a gateway the business already uses
     * (MSG91, Gupshup, Twilio, an AiSensy flow…). `webhook` POSTs a signed JSON
     * message to that gateway's endpoint; `console` logs it (development);
     * `none` turns the channel off. Indian SMS also needs DLT-registered
     * templates — the gateway maps `type` to its template.
     */
    /**
     * Where uploaded files (employee photos, later documents) live. `local`
     * writes under STORAGE_DIR on this server — a Docker volume in production,
     * outside anything the web server serves directly. Files are only ever
     * read back through the app, which checks who is asking.
     */
    STORAGE_DRIVER: z.enum(['local']).default('local'),
    STORAGE_DIR: z.string().min(1).default('./storage'),
    /** Largest file accepted from a browser, before compression. */
    ASSET_MAX_UPLOAD_MB: z.coerce.number().min(1).max(50).default(8),
    /** Total stored per organisation, after compression. */
    ASSET_ORG_QUOTA_MB: z.coerce.number().int().min(10).max(1_000_000).default(2048),

    SMS_PROVIDER: z.enum(['none', 'console', 'webhook']).default('none'),
    SMS_WEBHOOK_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.url().optional(),
    ),
    SMS_WEBHOOK_SECRET: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(16).optional(),
    ),
    WHATSAPP_PROVIDER: z.enum(['none', 'console', 'webhook']).default('none'),
    WHATSAPP_WEBHOOK_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.url().optional(),
    ),
    WHATSAPP_WEBHOOK_SECRET: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(16).optional(),
    ),

    /**
     * How many proxies in front of the app append to X-Forwarded-For. The
     * client address is read that many entries from the right, so anything a
     * client puts in the header itself is ignored. 1 = Caddy alone; 2 = e.g.
     * Cloudflare then Caddy; 0 = no proxy, the header is not trusted at all.
     */
    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  })
  .superRefine((value, ctx) => {
    for (const channel of ['SMS', 'WHATSAPP'] as const) {
      if (value[`${channel}_PROVIDER`] !== 'webhook') continue;
      for (const key of [`${channel}_WEBHOOK_URL`, `${channel}_WEBHOOK_SECRET`] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when ${channel}_PROVIDER=webhook`,
          });
        }
      }
    }

    if (value.NODE_ENV === 'production' && !value.REDIS_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message:
          'REDIS_URL is required in production: in-process rate limits do not hold across replicas or restarts',
      });
    }

    if (value.NODE_ENV === 'production') {
      // The example values are public; a server started with them has no secrets at all.
      for (const key of ['AUTH_SECRET', 'CRON_SECRET'] as const) {
        if (/replace-me|change-?me|example/i.test(value[key])) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} still holds the placeholder from .env.example; generate a real secret`,
          });
        }
      }
      // Session cookies are marked secure from this URL; plain http would send
      // them in the clear. Loopback stays allowed for trying a production build locally.
      const urls = {
        AUTH_URL: value.AUTH_URL,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      };
      for (const [key, url] of Object.entries(urls)) {
        if (url && !/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url)) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} must use https in production`,
          });
        }
      }
    }

    if (value.MAIL_TRANSPORT === 'smtp' && !value.SMTP_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_URL'],
        message: 'SMTP_URL is required when MAIL_TRANSPORT=smtp',
      });
    }
  });

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function parseServerEnv(): ServerEnv {
  // `next build` in CI has no database or secret manager attached. The deploy
  // still validates for real at container start.
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    return process.env as unknown as ServerEnv;
  }

  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment variables:\n${JSON.stringify(z.treeifyError(parsed.error), null, 2)}`,
    );
  }
  return parsed.data;
}
