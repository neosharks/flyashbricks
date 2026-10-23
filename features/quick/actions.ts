'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { parseOrFail, runAction } from '@/lib/action';
import { HOME_MODE_COOKIE_NAME, useSecureCookies } from '@/lib/cookies';
import { ok, type ActionResult } from '@/lib/result';
import { requireUser } from '@/lib/session';
import { HOME_MODES } from './tasks';

const HomeModeSchema = z.object({ mode: z.enum(HOME_MODES, 'invalid') }).strict();

/** Remembers on this device whether the app opens in simple mode or on the dashboard. */
export async function setHomeMode(mode: string): Promise<ActionResult> {
  return runAction('quick.setHomeMode', async () => {
    await requireUser();
    const parsed = parseOrFail(HomeModeSchema, { mode });
    if (!parsed.ok) return parsed.result;

    (await cookies()).set(HOME_MODE_COOKIE_NAME, parsed.data.mode, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: useSecureCookies,
      httpOnly: true,
    });
    return ok();
  });
}
