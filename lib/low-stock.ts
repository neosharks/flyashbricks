import 'server-only';
import type { ClientSession, ObjectId } from '@/lib/mongoose';
import { RawMaterial } from '@/models/raw-material';
import { Product } from '@/models/product';
import { notify } from '@/features/notifications/notify';

/**
 * Low-stock alerting, edge-triggered.
 *
 * Called after any write that changes a balance, inside the same transaction.
 * A notification goes out only when the balance *crosses* the threshold on the
 * way down, and the latch resets once it is back above — so a material sitting low
 * for a week produces one email, not one per production entry.
 */
export async function syncMaterialAlert(
  materialId: ObjectId,
  session: ClientSession,
): Promise<void> {
  const material = await RawMaterial.findById(materialId)
    .select('orgId name nameHi unit quantityMilli lowThresholdMilli lowAlertedAt isActive')
    .session(session)
    .lean();
  if (!material) return;

  const low = material.isActive && material.quantityMilli <= material.lowThresholdMilli;
  if (low && !material.lowAlertedAt) {
    await RawMaterial.updateOne(
      { _id: materialId },
      { $set: { lowAlertedAt: new Date() } },
      { session },
    );
    await notify(
      {
        orgId: material.orgId.toString(),
        type: 'material_low',
        params: {
          name: material.name,
          nameHi: material.nameHi ?? material.name,
          qtyMilli: material.quantityMilli,
          unit: material.unit,
        },
        href: `/raw-materials/${materialId.toString()}`,
      },
      session,
    );
  } else if (!low && material.lowAlertedAt) {
    await RawMaterial.updateOne({ _id: materialId }, { $set: { lowAlertedAt: null } }, { session });
  }
}

export async function syncProductAlert(productId: ObjectId, session: ClientSession): Promise<void> {
  const product = await Product.findById(productId)
    .select('orgId name nameHi stockGood lowStockThreshold lowAlertedAt isActive')
    .session(session)
    .lean();
  if (!product) return;

  const low =
    product.isActive &&
    product.lowStockThreshold > 0 &&
    product.stockGood <= product.lowStockThreshold;
  if (low && !product.lowAlertedAt) {
    await Product.updateOne(
      { _id: productId },
      { $set: { lowAlertedAt: new Date() } },
      { session },
    );
    await notify(
      {
        orgId: product.orgId.toString(),
        type: 'bricks_low',
        params: {
          name: product.name,
          nameHi: product.nameHi ?? product.name,
          count: product.stockGood,
        },
        href: '/stock',
      },
      session,
    );
  } else if (!low && product.lowAlertedAt) {
    await Product.updateOne({ _id: productId }, { $set: { lowAlertedAt: null } }, { session });
  }
}
