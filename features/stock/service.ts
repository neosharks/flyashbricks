import 'server-only';
import { Types, type ClientSession } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { startOfDay } from '@/lib/dates';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { inTransaction } from '@/lib/transaction';
import { recordAudit } from '@/lib/audit';
import { syncProductAlert } from '@/lib/low-stock';
import type { SessionUser } from '@/lib/permissions';
import { Product } from '@/models/product';
import { RawMaterial } from '@/models/raw-material';
import { applyStockChange } from './ledger';
import type { AdjustStockInput, CreateProductInput, UpdateProductInput } from './schema';

function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === 11000;
}

/** Every recipe material must exist in the actor's organisation. */
async function assertRecipeMaterials(
  orgId: string,
  recipe: CreateProductInput['recipe'],
  session: ClientSession,
): Promise<void> {
  if (recipe.length === 0) return;
  const found = await RawMaterial.countDocuments({
    orgId,
    _id: { $in: recipe.map((line) => line.materialId) },
  }).session(session);
  if (found !== recipe.length) {
    throw new ValidationError('Unknown material', { recipe: ['invalid'] });
  }
}

function toRecipe(recipe: CreateProductInput['recipe']) {
  return recipe.map((line) => ({
    materialId: new Types.ObjectId(line.materialId),
    qtyMilli: line.qtyMilli,
  }));
}

export async function createProduct(
  actor: SessionUser,
  input: CreateProductInput,
): Promise<string> {
  await connectDb();
  try {
    return await inTransaction(async (session) => {
      await assertRecipeMaterials(actor.orgId, input.recipe, session);
      const [created] = await Product.create(
        [
          {
            ...input,
            recipe: toRecipe(input.recipe),
            orgId: new Types.ObjectId(actor.orgId),
            stockGood: 0,
          },
        ],
        { session },
      );
      if (!created) throw new Error('product insert returned nothing');
      await syncProductAlert(created._id, session);
      await recordAudit(
        {
          actor,
          action: 'product.create',
          entity: 'Product',
          entityId: created._id.toString(),
          changes: { name: input.name, recipeItems: input.recipe.length },
        },
        session,
      );
      return created._id.toString();
    });
  } catch (err) {
    if (isDuplicateKey(err)) throw new ConflictError('DUPLICATE_NAME', 'Name already used');
    throw err;
  }
}

export async function updateProduct(actor: SessionUser, input: UpdateProductInput): Promise<void> {
  await connectDb();
  const { id, ...fields } = input;
  try {
    await inTransaction(async (session) => {
      await assertRecipeMaterials(actor.orgId, fields.recipe, session);
      const result = await Product.updateOne(
        { _id: id, orgId: actor.orgId },
        { $set: { ...fields, recipe: toRecipe(fields.recipe) } },
        { session, runValidators: true },
      );
      if (result.matchedCount === 0) throw new NotFoundError('Product');
      await syncProductAlert(new Types.ObjectId(id), session);
      await recordAudit(
        {
          actor,
          action: 'product.update',
          entity: 'Product',
          entityId: id,
          changes: {
            name: fields.name,
            defaultRatePaise: fields.defaultRatePaise,
            recipeItems: fields.recipe.length,
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

/** Corrects the count after a physical tally, breakage or a yard transfer. */
export async function adjustStock(
  actor: SessionUser,
  input: AdjustStockInput,
  timezone: string,
): Promise<number> {
  await connectDb();
  return inTransaction(async (session) => {
    let delta = input.mode === 'remove' ? -input.qty : input.qty;
    if (input.mode === 'set') {
      const current = await Product.findOne({ _id: input.productId, orgId: actor.orgId })
        .select('stockGood')
        .session(session)
        .lean();
      if (!current) throw new NotFoundError('Product');
      delta = input.qty - current.stockGood;
    }
    if (delta === 0) return 0;

    await applyStockChange(
      {
        orgId: actor.orgId,
        productId: input.productId,
        qty: delta,
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
        action: 'product.adjust',
        entity: 'Product',
        entityId: input.productId,
        changes: { qty: delta, reason: input.reason },
      },
      session,
    );
    return delta;
  });
}
