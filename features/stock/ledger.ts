import 'server-only';
import { Types, type ClientSession } from '@/lib/mongoose';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { syncProductAlert } from '@/lib/low-stock';
import { Product } from '@/models/product';
import { StockMovement } from '@/models/stock-movement';
import type { StockMovementType } from '@/models/constants';

export type StockChange = {
  orgId: string;
  productId: string;
  /** Signed brick count: positive adds to stock, negative takes from it. */
  qty: number;
  type: StockMovementType;
  refId?: string | null;
  note?: string | null;
  occurredAt: Date;
  actorId: string;
};

/**
 * The only way brick stock changes. Updates the running count and appends the
 * ledger row in the caller's transaction, so the two can never disagree.
 *
 * A decrease is a conditional update — the filter `stockGood >= n` *is* the
 * guard — so two sales racing for the last bricks cannot both succeed and the
 * count can never go negative.
 */
export async function applyStockChange(
  change: StockChange,
  session: ClientSession,
): Promise<number> {
  if (!Number.isInteger(change.qty) || change.qty === 0) {
    throw new Error(`applyStockChange: qty must be a non-zero integer, got ${change.qty}`);
  }

  const orgId = new Types.ObjectId(change.orgId);
  const productId = new Types.ObjectId(change.productId);
  const taking = change.qty < 0;

  const updated = await Product.findOneAndUpdate(
    {
      _id: productId,
      orgId,
      ...(taking ? { stockGood: { $gte: -change.qty } } : {}),
    },
    { $inc: { stockGood: change.qty } },
    { returnDocument: 'after', session, projection: { stockGood: 1 } },
  ).lean();

  if (!updated) {
    const exists = await Product.exists({ _id: productId, orgId }).session(session);
    if (!exists) throw new NotFoundError('Product');
    throw new ConflictError('INSUFFICIENT_STOCK', 'Not enough bricks in stock');
  }

  await StockMovement.create(
    [
      {
        orgId,
        productId,
        type: change.type,
        qty: change.qty,
        balanceAfter: updated.stockGood,
        refId: change.refId ? new Types.ObjectId(change.refId) : null,
        note: change.note ?? null,
        occurredAt: change.occurredAt,
        createdBy: new Types.ObjectId(change.actorId),
      },
    ],
    { session },
  );

  await syncProductAlert(productId, session);
  return updated.stockGood;
}
