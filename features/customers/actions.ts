'use server';

import { revalidatePath } from 'next/cache';
import { connectDb } from '@/lib/db';
import { formDataToObject, parseOrFail, runAction } from '@/lib/action';
import { ok, type ActionResult } from '@/lib/result';
import { RateLimitError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { requirePermission } from '@/lib/session';
import { inTransaction } from '@/lib/transaction';
import { withFieldErrors } from '@/features/sales/action-errors';
import { createCustomer, updateCustomer } from './service';
import { searchCustomerOptions } from './queries';
import { CreateCustomerSchema, CustomerSearchSchema, UpdateCustomerSchema } from './schema';
import type { CustomerOption } from './types';

const phoneRow = (index: number | null) => (index === null ? null : `phones.${index}`);

async function throttle(userId: string): Promise<void> {
  const limited = await rateLimit('write', userId);
  if (!limited.success) throw new RateLimitError(limited.resetSeconds);
}

export async function createCustomerAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return runAction('customers.create', async () => {
    const actor = await requirePermission('sales:write');
    await throttle(actor.id);

    const parsed = parseOrFail(CreateCustomerSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    return withFieldErrors(async () => {
      await connectDb();
      const created = await createCustomer(actor, parsed.data);
      revalidatePath('/customers');
      return ok({ id: created._id.toString() });
    }, phoneRow);
  });
}

export async function updateCustomerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('customers.update', async () => {
    const actor = await requirePermission('sales:write');
    await throttle(actor.id);

    const parsed = parseOrFail(UpdateCustomerSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    return withFieldErrors(async () => {
      await connectDb();
      await inTransaction((session) => updateCustomer(actor, parsed.data, session));
      revalidatePath('/customers');
      revalidatePath(`/customers/${parsed.data.id}`);
      return ok();
    }, phoneRow);
  });
}

/** Feeds the customer picker on the new-sale form. */
export async function searchCustomersAction(q: string): Promise<ActionResult<CustomerOption[]>> {
  return runAction('customers.search', async () => {
    const actor = await requirePermission('sales:read');
    const parsed = parseOrFail(CustomerSearchSchema, { q });
    if (!parsed.ok) return parsed.result;
    return ok(await searchCustomerOptions(actor, parsed.data.q));
  });
}
