import 'server-only';
import { Types, type ClientSession } from '@/lib/mongoose';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { syncMaterialAlert } from '@/lib/low-stock';
import { RawMaterial } from '@/models/raw-material';
import { MaterialMovement } from '@/models/material-movement';
import type { MaterialMovementType } from '@/models/constants';

export type MaterialChange = {
  orgId: string;
  materialId: string;
  /** Signed milli-units: purchases add, consumption takes. */
  qtyMilli: number;
  type: MaterialMovementType;
  costPaise?: number | null;
  supplier?: string | null;
  note?: string | null;
  productionId?: string | null;
  occurredAt: Date;
  actorId: string;
};

/**
 * The only way a raw material's balance changes. Updates the running balance
 * and appends the ledger row in the caller's transaction.
 *
 * A decrease is a conditional update — the filter `quantityMilli >= n` is the
 * guard — so the yard can never be recorded as holding less than nothing, and
 * two production entries racing for the last cement cannot both succeed.
 */
export async function applyMaterialChange(
  change: MaterialChange,
  session: ClientSession,
): Promise<number> {
  if (!Number.isInteger(change.qtyMilli) || change.qtyMilli === 0) {
    throw new Error(
      `applyMaterialChange: qtyMilli must be a non-zero integer, got ${change.qtyMilli}`,
    );
  }

  const orgId = new Types.ObjectId(change.orgId);
  const materialId = new Types.ObjectId(change.materialId);
  const taking = change.qtyMilli < 0;

  const updated = await RawMaterial.findOneAndUpdate(
    {
      _id: materialId,
      orgId,
      ...(taking ? { quantityMilli: { $gte: -change.qtyMilli } } : {}),
    },
    { $inc: { quantityMilli: change.qtyMilli } },
    { returnDocument: 'after', session, projection: { quantityMilli: 1 } },
  ).lean();

  if (!updated) {
    const exists = await RawMaterial.exists({ _id: materialId, orgId }).session(session);
    if (!exists) throw new NotFoundError('RawMaterial');
    throw new ConflictError('INSUFFICIENT_MATERIAL', 'Not enough raw material on record');
  }

  await MaterialMovement.create(
    [
      {
        orgId,
        materialId,
        type: change.type,
        qtyMilli: change.qtyMilli,
        balanceAfterMilli: updated.quantityMilli,
        costPaise: change.costPaise ?? null,
        supplier: change.supplier ?? null,
        note: change.note ?? null,
        productionId: change.productionId ? new Types.ObjectId(change.productionId) : null,
        occurredAt: change.occurredAt,
        createdBy: new Types.ObjectId(change.actorId),
      },
    ],
    { session },
  );

  await syncMaterialAlert(materialId, session);
  return updated.quantityMilli;
}
