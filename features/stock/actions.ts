'use server';

import { revalidatePath } from 'next/cache';
import { formDataToObject, parseOrFail, runAction } from '@/lib/action';
import { ok, type ActionResult } from '@/lib/result';
import { RateLimitError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { requirePermission } from '@/lib/session';
import type { SessionUser } from '@/lib/permissions';
import { getOrgTimezone } from '@/lib/org';
import { AdjustStockSchema, CreateProductSchema, foldRecipe, UpdateProductSchema } from './schema';
import { adjustStock, createProduct, updateProduct } from './service';

async function writer(): Promise<SessionUser> {
  const actor = await requirePermission('production:write');
  const limited = await rateLimit('write', actor.id);
  if (!limited.success) throw new RateLimitError(limited.resetSeconds);
  return actor;
}

function revalidate(): void {
  revalidatePath('/stock');
  revalidatePath('/production');
  revalidatePath('/');
}

export async function createProductAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('stock.createProduct', async () => {
    const actor = await writer();
    const parsed = parseOrFail(CreateProductSchema, foldRecipe(formDataToObject(formData)));
    if (!parsed.ok) return parsed.result;

    await createProduct(actor, parsed.data);
    revalidate();
    return ok();
  });
}

export async function updateProductAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('stock.updateProduct', async () => {
    const actor = await writer();
    const parsed = parseOrFail(UpdateProductSchema, foldRecipe(formDataToObject(formData)));
    if (!parsed.ok) return parsed.result;

    await updateProduct(actor, parsed.data);
    revalidate();
    return ok();
  });
}

export async function adjustStockAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('stock.adjust', async () => {
    const actor = await writer();
    const parsed = parseOrFail(AdjustStockSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    await adjustStock(actor, parsed.data, await getOrgTimezone(actor.orgId));
    revalidate();
    return ok();
  });
}
