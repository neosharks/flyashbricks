import 'server-only';
import { Types } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { startOfDay } from '@/lib/dates';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { inTransaction } from '@/lib/transaction';
import { recordAudit } from '@/lib/audit';
import type { SessionUser } from '@/lib/permissions';
import { Product } from '@/models/product';
import { ProductionEntry } from '@/models/production-entry';
import { applyMaterialChange } from '@/features/raw-materials/ledger';
import { applyStockChange } from '@/features/stock/ledger';
import { plannedConsumption } from './consumption';
import type { LogProductionInput, VoidProductionInput } from './schema';

/**
 * Records a production run in one transaction: the entry, the raw material it
 * consumed (per the brick type's recipe), and the good bricks added to stock.
 * If any ingredient is short on record, nothing is written.
 */
export async function logProduction(
  actor: SessionUser,
  input: LogProductionInput,
  timezone: string,
  today: string,
): Promise<string> {
  if (input.date > today) {
    throw new ValidationError('Date in the future', { date: ['futureDate'] });
  }
  await connectDb();

  return inTransaction(async (session) => {
    const product = await Product.findOne({ _id: input.productId, orgId: actor.orgId })
      .session(session)
      .lean();
    if (!product) throw new NotFoundError('Product');
    if (!product.isActive) throw new ConflictError('INACTIVE', 'Brick type is inactive');

    const occurredAt = startOfDay(input.date, timezone);
    const bricks = input.goodQty + input.defectiveQty;
    const consumption = plannedConsumption(
      product.recipe.map((line) => ({
        materialId: line.materialId.toString(),
        qtyMilli: line.qtyMilli,
      })),
      product.recipeBatchSize,
      bricks,
      new Map(),
    );

    const [entry] = await ProductionEntry.create(
      [
        {
          orgId: new Types.ObjectId(actor.orgId),
          productId: product._id,
          productName: product.name,
          productNameHi: product.nameHi ?? null,
          date: occurredAt,
          goodQty: input.goodQty,
          defectiveQty: input.defectiveQty,
          note: input.note,
          consumption: consumption.map((line) => ({
            materialId: new Types.ObjectId(line.materialId),
            qtyMilli: line.needMilli,
          })),
          createdBy: new Types.ObjectId(actor.id),
          createdByName: actor.name,
        },
      ],
      { session },
    );
    if (!entry) throw new Error('production insert returned nothing');
    const entryId = entry._id.toString();

    for (const line of consumption) {
      await applyMaterialChange(
        {
          orgId: actor.orgId,
          materialId: line.materialId,
          qtyMilli: -line.needMilli,
          type: 'consumption',
          productionId: entryId,
          occurredAt,
          actorId: actor.id,
        },
        session,
      );
    }

    if (input.goodQty > 0) {
      await applyStockChange(
        {
          orgId: actor.orgId,
          productId: product._id.toString(),
          qty: input.goodQty,
          type: 'production',
          refId: entryId,
          occurredAt,
          actorId: actor.id,
        },
        session,
      );
    }

    await recordAudit(
      {
        actor,
        action: 'production.create',
        entity: 'ProductionEntry',
        entityId: entryId,
        changes: {
          product: product.name,
          date: input.date,
          goodQty: input.goodQty,
          defectiveQty: input.defectiveQty,
        },
      },
      session,
    );
    return entryId;
  });
}

/**
 * Voids an entry entered by mistake: returns its materials and removes its
 * good bricks. Refused if those bricks have since been sold — the stock to
 * take back no longer exists, and the sale would have to be voided first.
 */
export async function voidProduction(
  actor: SessionUser,
  input: VoidProductionInput,
): Promise<void> {
  await connectDb();

  await inTransaction(async (session) => {
    const entry = await ProductionEntry.findOneAndUpdate(
      { _id: input.id, orgId: actor.orgId, voidedAt: null },
      { $set: { voidedAt: new Date(), voidReason: input.reason } },
      { returnDocument: 'after', session },
    ).lean();

    if (!entry) {
      const exists = await ProductionEntry.exists({ _id: input.id, orgId: actor.orgId }).session(
        session,
      );
      if (!exists) throw new NotFoundError('ProductionEntry');
      throw new ConflictError('ALREADY_VOIDED', 'Already voided');
    }

    const occurredAt = new Date();
    for (const line of entry.consumption) {
      if (line.qtyMilli <= 0) continue;
      await applyMaterialChange(
        {
          orgId: actor.orgId,
          materialId: line.materialId.toString(),
          qtyMilli: line.qtyMilli,
          type: 'consumption_reversal',
          productionId: entry._id.toString(),
          note: input.reason,
          occurredAt,
          actorId: actor.id,
        },
        session,
      );
    }

    if (entry.goodQty > 0) {
      await applyStockChange(
        {
          orgId: actor.orgId,
          productId: entry.productId.toString(),
          qty: -entry.goodQty,
          type: 'production_void',
          refId: entry._id.toString(),
          note: input.reason,
          occurredAt,
          actorId: actor.id,
        },
        session,
      );
    }

    await recordAudit(
      {
        actor,
        action: 'production.void',
        entity: 'ProductionEntry',
        entityId: entry._id.toString(),
        changes: { product: entry.productName, goodQty: entry.goodQty, reason: input.reason },
      },
      session,
    );
  });
}
