'use server';

import { revalidatePath } from 'next/cache';
import { formDataToObject, parseOrFail, runAction } from '@/lib/action';
import { ok, type ActionResult } from '@/lib/result';
import { RateLimitError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { requirePermission } from '@/lib/session';
import { todayKey } from '@/lib/dates';
import type { SessionUser } from '@/lib/permissions';
import { LogProductionSchema, VoidProductionSchema } from './schema';
import { logProduction, voidProduction } from './service';
import { getOrgTimezone } from '@/lib/org';

async function writer(): Promise<SessionUser> {
  const actor = await requirePermission('production:write');
  const limited = await rateLimit('write', actor.id);
  if (!limited.success) throw new RateLimitError(limited.resetSeconds);
  return actor;
}

/** Production touches stock and raw materials, so all three views refresh. */
function revalidate(): void {
  revalidatePath('/production');
  revalidatePath('/stock');
  revalidatePath('/raw-materials', 'layout');
  revalidatePath('/');
}

export async function logProductionAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction('production.log', async () => {
    const actor = await writer();
    const parsed = parseOrFail(LogProductionSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    const timezone = await getOrgTimezone(actor.orgId);
    const id = await logProduction(actor, parsed.data, timezone, todayKey(timezone));
    revalidate();
    return ok({ id });
  });
}

export async function voidProductionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('production.void', async () => {
    const actor = await writer();
    const parsed = parseOrFail(VoidProductionSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    await voidProduction(actor, parsed.data);
    revalidate();
    return ok();
  });
}
