// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Types } from '@/lib/mongoose';
import { clearTestDb, startTestDb, stopTestDb, syncIndexes } from '@/tests/db';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { NO_ACCESS, type SessionUser } from '@/lib/permissions';
import { RawMaterial } from '@/models/raw-material';
import { MaterialMovement } from '@/models/material-movement';
import { Product } from '@/models/product';
import { ProductionEntry } from '@/models/production-entry';
import { StockMovement } from '@/models/stock-movement';
import { AuditLog } from '@/models/audit-log';
import { applyStockChange } from '@/features/stock/ledger';
import { adjustStock, createProduct } from '@/features/stock/service';
import { adjustMaterial, createMaterial, recordPurchase } from '@/features/raw-materials/service';
import { inTransaction } from '@/lib/transaction';
import { logProduction, voidProduction } from './service';

// The test owns the connection (tests/db.ts); the app's connector must not open another.
vi.mock('@/lib/db', () => ({ connectDb: () => Promise.resolve() }));

beforeAll(async () => {
  await startTestDb();
  await syncIndexes([RawMaterial, MaterialMovement, Product, ProductionEntry, StockMovement]);
}, 180_000);
afterEach(clearTestDb);
afterAll(stopTestDb);

const TZ = 'Asia/Kolkata';
const TODAY = '2026-10-12';

function actorIn(orgId = new Types.ObjectId()): SessionUser {
  return {
    id: new Types.ObjectId().toString(),
    orgId: orgId.toString(),
    name: 'Supervisor',
    role: 'admin',
    permissions: NO_ACCESS,
    mustChangePassword: false,
  };
}

/** A yard with fly ash and cement and one brick type that uses both per 100 bricks. */
async function seedYard(actor: SessionUser, { ash = '10000', cement = '500' } = {}) {
  const ashId = await createMaterial(
    actor,
    {
      name: 'Fly ash',
      nameHi: null,
      kind: 'fly_ash',
      unit: 'kg',
      lowThresholdMilli: 0,
      capacityMilli: null,
      isActive: true,
      openingMilli: Number(ash) * 1000,
    },
    TZ,
    TODAY,
  );
  const cementId = await createMaterial(
    actor,
    {
      name: 'Cement',
      nameHi: null,
      kind: 'cement',
      unit: 'kg',
      lowThresholdMilli: 0,
      capacityMilli: null,
      isActive: true,
      openingMilli: Number(cement) * 1000,
    },
    TZ,
    TODAY,
  );
  const productId = await createProduct(actor, {
    name: 'Standard',
    nameHi: null,
    size: null,
    defaultRatePaise: 650,
    recipeBatchSize: 100,
    recipe: [
      { materialId: ashId, qtyMilli: 150_000 },
      { materialId: cementId, qtyMilli: 25_000 },
    ],
    lowStockThreshold: 0,
    isActive: true,
  });
  return { ashId, cementId, productId };
}

async function quantities(...ids: string[]) {
  const docs = await RawMaterial.find({ _id: { $in: ids } }).lean();
  return ids.map((id) => docs.find((doc) => doc._id.toString() === id)?.quantityMilli);
}

describe('logProduction', () => {
  it('consumes the recipe for every brick pressed and stocks only the good ones', async () => {
    const actor = actorIn();
    const { ashId, cementId, productId } = await seedYard(actor);

    const id = await logProduction(
      actor,
      { productId, date: TODAY, goodQty: 950, defectiveQty: 50, note: null },
      TZ,
      TODAY,
    );

    // 1,000 bricks pressed: 1,500 kg ash and 250 kg cement.
    expect(await quantities(ashId, cementId)).toEqual([8_500_000, 250_000]);
    expect((await Product.findById(productId).lean())?.stockGood).toBe(950);

    const entry = await ProductionEntry.findById(id).lean();
    expect(entry?.consumption.map((line) => line.qtyMilli)).toEqual([1_500_000, 250_000]);
    expect(await MaterialMovement.countDocuments({ productionId: id, type: 'consumption' })).toBe(
      2,
    );
    expect(await AuditLog.countDocuments({ action: 'production.create', entityId: id })).toBe(1);
  });

  it('writes nothing at all when one ingredient is short', async () => {
    const actor = actorIn();
    const { ashId, cementId, productId } = await seedYard(actor, { cement: '100' });

    await expect(
      logProduction(
        actor,
        { productId, date: TODAY, goodQty: 1_000, defectiveQty: 0, note: null },
        TZ,
        TODAY,
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_MATERIAL' });

    expect(await quantities(ashId, cementId)).toEqual([10_000_000, 100_000]);
    expect((await Product.findById(productId).lean())?.stockGood).toBe(0);
    expect(await ProductionEntry.countDocuments()).toBe(0);
  });

  it('refuses a future date and another organisation’s brick type', async () => {
    const actor = actorIn();
    const { productId } = await seedYard(actor);
    await expect(
      logProduction(
        actor,
        { productId, date: '2026-10-13', goodQty: 1, defectiveQty: 0, note: null },
        TZ,
        TODAY,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      logProduction(
        actorIn(),
        { productId, date: TODAY, goodQty: 1, defectiveQty: 0, note: null },
        TZ,
        TODAY,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses an inactive brick type', async () => {
    const actor = actorIn();
    const { productId } = await seedYard(actor);
    await Product.updateOne({ _id: productId }, { $set: { isActive: false } });
    await expect(
      logProduction(
        actor,
        { productId, date: TODAY, goodQty: 1, defectiveQty: 0, note: null },
        TZ,
        TODAY,
      ),
    ).rejects.toMatchObject({ code: 'INACTIVE' });
  });
});

describe('voidProduction', () => {
  it('returns the materials and takes the bricks back out of stock', async () => {
    const actor = actorIn();
    const { ashId, cementId, productId } = await seedYard(actor);
    const id = await logProduction(
      actor,
      { productId, date: TODAY, goodQty: 900, defectiveQty: 100, note: null },
      TZ,
      TODAY,
    );

    await voidProduction(actor, { id, reason: 'Entered twice' });

    expect(await quantities(ashId, cementId)).toEqual([10_000_000, 500_000]);
    expect((await Product.findById(productId).lean())?.stockGood).toBe(0);
    expect((await ProductionEntry.findById(id).lean())?.voidReason).toBe('Entered twice');
  });

  it('cannot be voided twice', async () => {
    const actor = actorIn();
    const { productId } = await seedYard(actor);
    const id = await logProduction(
      actor,
      { productId, date: TODAY, goodQty: 10, defectiveQty: 0, note: null },
      TZ,
      TODAY,
    );
    await voidProduction(actor, { id, reason: 'Mistake' });
    await expect(voidProduction(actor, { id, reason: 'Again' })).rejects.toMatchObject({
      code: 'ALREADY_VOIDED',
    });
  });

  it('is refused once the bricks have been sold, and changes nothing', async () => {
    const actor = actorIn();
    const { cementId, productId } = await seedYard(actor);
    const id = await logProduction(
      actor,
      { productId, date: TODAY, goodQty: 100, defectiveQty: 0, note: null },
      TZ,
      TODAY,
    );

    await inTransaction((session) =>
      applyStockChange(
        {
          orgId: actor.orgId,
          productId,
          qty: -60,
          type: 'sale',
          occurredAt: new Date(),
          actorId: actor.id,
        },
        session,
      ),
    );

    await expect(voidProduction(actor, { id, reason: 'Mistake' })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect((await ProductionEntry.findById(id).lean())?.voidedAt).toBeNull();
    expect(await quantities(cementId)).toEqual([475_000]);
  });
});

describe('material and stock corrections', () => {
  it('records the purchase rate per unit and adjusts to a counted quantity', async () => {
    const actor = actorIn();
    const { cementId, productId } = await seedYard(actor);

    await recordPurchase(
      actor,
      {
        materialId: cementId,
        qtyMilli: 1_000_000,
        costPaise: 800_000,
        supplier: null,
        date: TODAY,
        note: null,
      },
      TZ,
    );
    const cement = await RawMaterial.findById(cementId).lean();
    expect(cement?.quantityMilli).toBe(1_500_000);
    expect(cement?.lastRatePaise).toBe(800);

    const delta = await adjustMaterial(
      actor,
      {
        materialId: cementId,
        mode: 'set',
        qtyMilli: 1_400_000,
        reason: 'Physical count',
        date: TODAY,
      },
      TZ,
    );
    expect(delta).toBe(-100_000);

    await adjustStock(
      actor,
      { productId, mode: 'add', qty: 500, reason: 'Opening stock', date: TODAY },
      TZ,
    );
    expect(
      await adjustStock(
        actor,
        { productId, mode: 'set', qty: 500, reason: 'Count matches', date: TODAY },
        TZ,
      ),
    ).toBe(0);
    await expect(
      adjustStock(
        actor,
        { productId, mode: 'remove', qty: 501, reason: 'Broken', date: TODAY },
        TZ,
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
  });

  it('rejects a duplicate material name in the same organisation only', async () => {
    const actor = actorIn();
    await seedYard(actor);
    await expect(
      createMaterial(
        actor,
        {
          name: 'cement',
          nameHi: null,
          kind: 'cement',
          unit: 'kg',
          lowThresholdMilli: 0,
          capacityMilli: null,
          isActive: true,
          openingMilli: null,
        },
        TZ,
        TODAY,
      ),
    ).rejects.toMatchObject({ code: 'DUPLICATE_NAME' });
    await expect(seedYard(actorIn())).resolves.toBeDefined();
  });

  it('refuses a recipe that names another organisation’s material', async () => {
    const actor = actorIn();
    const { ashId } = await seedYard(actor);
    await expect(
      createProduct(actorIn(), {
        name: 'Stolen recipe',
        nameHi: null,
        size: null,
        defaultRatePaise: 0,
        recipeBatchSize: 1,
        recipe: [{ materialId: ashId, qtyMilli: 1 }],
        lowStockThreshold: 0,
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
