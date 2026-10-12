'use server';

import { revalidatePath } from 'next/cache';
import { connectDb } from '@/lib/db';
import { formDataToObject, parseOrFail, runAction } from '@/lib/action';
import { ok, type ActionResult } from '@/lib/result';
import { NotFoundError } from '@/lib/errors';
import { requirePermission } from '@/lib/session';
import { recordAudit } from '@/lib/audit';
import { Organization } from '@/models/organization';
import { BusinessSettingsSchema } from './schema';

export async function updateBusinessSettings(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction('settings.update', async () => {
    const actor = await requirePermission('settings:manage');

    const parsed = parseOrFail(BusinessSettingsSchema, formDataToObject(formData));
    if (!parsed.ok) return parsed.result;

    await connectDb();
    const result = await Organization.updateOne(
      { _id: actor.orgId },
      { $set: parsed.data },
      { runValidators: true },
    );
    if (result.matchedCount === 0) throw new NotFoundError('Organization');

    await recordAudit({
      actor,
      action: 'settings.update',
      entity: 'Organization',
      entityId: actor.orgId,
      changes: {
        name: parsed.data.name,
        gstin: parsed.data.gstin,
        gstRateBps: parsed.data.gstRateBps,
        invoicePrefix: parsed.data.invoicePrefix,
      },
    });

    // Every page shows the business name; invoices made from now on use the new details.
    revalidatePath('/', 'layout');
    return ok();
  });
}
