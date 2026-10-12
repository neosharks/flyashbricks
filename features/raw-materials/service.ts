import 'server-only';
import { Types } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { startOfDay } from '@/lib/dates';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { inTransaction } from '@/lib/transaction';
import { recordAudit } from '@/lib/audit';
import { syncMaterialAlert } from '@/lib/low-stock';
import type { SessionUser } from '@/lib/permissions';
import { RawMaterial } from '@/models/raw-material';
import { applyMaterialChange } from './ledger';
import { ratePerUnit } from './forecast';
import type {
  AdjustMaterialInput,
  CreateMaterialInput,
  PurchaseInput,
  UpdateMaterialInput,
} from './schema';

/**
 * The transactional core of every raw material write, kept apart from the
 * 'use server' wrappers so it can be tested against a real database with a
 * plain actor and input.
 */

function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === 11000;
}

export async function createMaterial(
  actor: SessionUser,
  input: CreateMaterialInput,
  timezone: string,
  today: string,
): Promise<string> {
  await connectDb();
  const { openingMilli, ...fields } = input;

  try {
    return await inTransaction(async (session) => {
      const [created] = await RawMaterial.create(
        [{ ...fields, orgId: new Types.ObjectId(actor.orgId), quantityMilli: 0 }],
        { session },
      );
      if (!created) throw new Error('material insert returned nothing');
      const id = created._id.toString();

      // Opening stock goes through the ledger like any other change, so the
      // movement history adds up to the balance from day one.
      if (openingMilli) {
        await applyMaterialChange(
          {
            orgId: actor.orgId,
            materialId: id,
            qtyMilli: openingMilli,
            type: 'adjustment',
            note: 'Opening stock',
            occurredAt: startOfDay(today, timezone),
            actorId: actor.id,
          },
          session,
        );
      } else {
        await syncMaterialAlert(created._id, session);
      }

      await recordAudit(
        {
          actor,
          action: 'material.create',
          entity: 'RawMaterial',
          entityId: id,
          changes: { name: fields.name, unit: fields.unit, openingMilli: openingMilli ?? 0 },
        },
        session,
      );
      return id;
    });
  } catch (err) {
    if (isDuplicateKey(err)) throw new ConflictError('DUPLICATE_NAME', 'Name already used');
    throw err;
  }
}

export async function updateMaterial(
  actor: SessionUser,
  input: UpdateMaterialInput,
): Promise<void> {
  await connectDb();
  const { id, unit: _unit, ...fields } = input;

  try {
    await inTransaction(async (session) => {
      const result = await RawMaterial.updateOne(
        { _id: id, orgId: actor.orgId },
        { $set: fields },
        { session, runValidators: true },
      );
      if (result.matchedCount === 0) throw new NotFoundError('RawMaterial');
      // A new threshold can put the material on either side of the line.
      await syncMaterialAlert(new Types.ObjectId(id), session);
      await recordAudit(
        {
          actor,
          action: 'material.update',
          entity: 'RawMaterial',
          entityId: id,
          changes: {
            name: fields.name,
            lowThresholdMilli: fields.lowThresholdMilli,
            isActive: fields.isActive,
          },
        },
        session,
      );
    });
  } catch (err) {
    if (isDuplicateKey(err)) throw new ConflictError('DUPLICATE_NAME', 'Name already used');
    throw err;
  }
}

export async function recordPurchase(
  actor: SessionUser,
  input: PurchaseInput,
  timezone: string,
): Promise<void> {
  await connectDb();
  await inTransaction(async (session) => {
    await applyMaterialChange(
      {
        orgId: actor.orgId,
        materialId: input.materialId,
        qtyMilli: input.qtyMilli,
        type: 'purchase',
        costPaise: input.costPaise,
        supplier: input.supplier,
        note: input.note,
        occurredAt: startOfDay(input.date, timezone),
        actorId: actor.id,
      },
      session,
    );
    const rate = ratePerUnit(input.costPaise, input.qtyMilli);
    if (rate !== null && input.costPaise > 0) {
      await RawMaterial.updateOne(
        { _id: input.materialId, orgId: actor.orgId },
        { $set: { lastRatePaise: rate } },
        { session },
      );
    }
    await recordAudit(
      {
        actor,
        action: 'material.purchase',
        entity: 'RawMaterial',
        entityId: input.materialId,
        changes: { qtyMilli: input.qtyMilli, costPaise: input.costPaise, supplier: input.supplier },
      },
      session,
    );
  });
}

/** Returns the signed change applied; zero when a counted quantity matched the record. */
export async function adjustMaterial(
  actor: SessionUser,
  input: AdjustMaterialInput,
  timezone: string,
): Promise<number> {
  await connectDb();
  return inTransaction(async (session) => {
    let delta = input.mode === 'remove' ? -input.qtyMilli : input.qtyMilli;

    if (input.mode === 'set') {
      const current = await RawMaterial.findOne({ _id: input.materialId, orgId: actor.orgId })
        .select('quantityMilli')
        .session(session)
        .lean();
      if (!current) throw new NotFoundError('RawMaterial');
      delta = input.qtyMilli - current.quantityMilli;
    }
    if (delta === 0) return 0;

    await applyMaterialChange(
      {
        orgId: actor.orgId,
        materialId: input.materialId,
        qtyMilli: delta,
        type: 'adjustment',
        note: input.reason,
        occurredAt: startOfDay(input.date, timezone),
        actorId: actor.id,
      },
      session,
    );
    await recordAudit(
      {
        actor,
        action: 'material.adjust',
        entity: 'RawMaterial',
        entityId: input.materialId,
        changes: { qtyMilli: delta, reason: input.reason },
      },
      session,
    );
    return delta;
  });
}
