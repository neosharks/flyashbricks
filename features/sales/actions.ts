'use server';

import { revalidatePath } from 'next/cache';
import { connectDb } from '@/lib/db';
import { formDataToObject, parseOrFail, runAction } from '@/lib/action';
import { ok, type ActionResult } from '@/lib/result';
import { RateLimitError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { requirePermission } from '@/lib/session';
import { getOrgTimezone } from '@/lib/org';
import { addPayment, createSale, voidSale } from './service';
import { withFieldErrors } from './action-errors';
import { AddPaymentSchema, CreateSaleSchema, foldLines, VoidSaleSchema } from './schema';

async function throttle(userId: string): Promise<void> {
  const limited = await rateLimit('write', userId);
  if (!limited.success) throw new RateLimitError(limited.resetSeconds);
}

/** Every page that shows sale-derived numbers. */
function revalidateSales(saleId?: string, customerId?: string): void {
  revalidatePath('/sales');
  revalidatePath('/customers');
  revalidatePath('/stock');
  revalidatePath('/');
  if (saleId) revalidatePath(`/sales/${saleId}`);
  if (customerId) revalidatePath(`/customers/${customerId}`);
}

export async function createSaleAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction('sales.create', async () => {
    const actor = await requirePermission('sales:write');
    await throttle(actor.id);

    const parsed = parseOrFail(CreateSaleSchema, foldLines(formDataToObject(formData)));
    if (!parsed.ok) return parsed.result;

    return withFieldErrors(
      async () => {
        await connectDb();
        const timeZone = await getOrgTimezone(actor.orgId);
        const { id } = await createSale(actor, parsed.data, timeZone);
        revalidateSales(id, parsed.data.customerId);
        return ok({ id });
      },
      () => 'newCustomerPhone',
    );
  });
}

export async function addPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('sales.addPayment', async () => {
    const actor = await requirePermission('sales:write');
    await throttle(actor.id);

    const parsed = parseOrFail(AddPaymentSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    return withFieldErrors(
      async () => {
        await connectDb();
        await addPayment(actor, parsed.data, await getOrgTimezone(actor.orgId));
        revalidateSales(parsed.data.saleId);
        return ok();
      },
      () => null,
    );
  });
}

export async function voidSaleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('sales.void', async () => {
    const actor = await requirePermission('sales:void');
    await throttle(actor.id);

    const parsed = parseOrFail(VoidSaleSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    await connectDb();
    await voidSale(actor, parsed.data);
    revalidateSales(parsed.data.saleId);
    return ok();
  });
}
