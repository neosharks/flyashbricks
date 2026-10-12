'use server';

import { revalidatePath } from 'next/cache';
import { formDataToObject, parseOrFail, runAction } from '@/lib/action';
import { ok, type ActionResult } from '@/lib/result';
import { RateLimitError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { requirePermission } from '@/lib/session';
import { todayKey } from '@/lib/dates';
import type { SessionUser } from '@/lib/permissions';
import { getOrgTimezone } from '@/lib/org';
import {
  AdjustMaterialSchema,
  CreateMaterialSchema,
  PurchaseSchema,
  UpdateMaterialSchema,
} from './schema';
import { adjustMaterial, createMaterial, recordPurchase, updateMaterial } from './service';

async function writer(): Promise<SessionUser> {
  const actor = await requirePermission('rawMaterials:write');
  const limited = await rateLimit('write', actor.id);
  if (!limited.success) throw new RateLimitError(limited.resetSeconds);
  return actor;
}

function revalidate(materialId?: string): void {
  revalidatePath('/raw-materials');
  if (materialId) revalidatePath(`/raw-materials/${materialId}`);
  revalidatePath('/');
}

export async function createMaterialAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction('rawMaterials.create', async () => {
    const actor = await writer();
    const parsed = parseOrFail(CreateMaterialSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    const timezone = await getOrgTimezone(actor.orgId);
    const id = await createMaterial(actor, parsed.data, timezone, todayKey(timezone));
    revalidate();
    return ok({ id });
  });
}

export async function updateMaterialAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('rawMaterials.update', async () => {
    const actor = await writer();
    const parsed = parseOrFail(UpdateMaterialSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    await updateMaterial(actor, parsed.data);
    revalidate(parsed.data.id);
    return ok();
  });
}

export async function recordPurchaseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('rawMaterials.purchase', async () => {
    const actor = await writer();
    const parsed = parseOrFail(PurchaseSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    await recordPurchase(actor, parsed.data, await getOrgTimezone(actor.orgId));
    revalidate(parsed.data.materialId);
    return ok();
  });
}

export async function adjustMaterialAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('rawMaterials.adjust', async () => {
    const actor = await writer();
    const parsed = parseOrFail(AdjustMaterialSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    await adjustMaterial(actor, parsed.data, await getOrgTimezone(actor.orgId));
    revalidate(parsed.data.materialId);
    return ok();
  });
}
