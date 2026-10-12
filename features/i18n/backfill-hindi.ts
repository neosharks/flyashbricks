import type { mongo } from 'mongoose';
import { toHindi } from '@/lib/transliterate';
import { searchTerms } from '@/lib/utils';

type Db = { collection(name: string): mongo.Collection };

export type HindiBackfillCounts = Record<string, number>;

const hindi = (text: unknown): string | null =>
  typeof text === 'string' && text.trim() !== '' ? toHindi(text) : null;

/**
 * Sets each `<field>Hi` that a document does not have yet from its English
 * counterpart. Only missing fields are written, so re-running changes nothing
 * and a Hindi spelling someone has since corrected is never overwritten.
 */
async function fillFields(
  collection: mongo.Collection,
  fields: string[],
  extra?: (doc: mongo.Document, set: Record<string, unknown>) => void,
): Promise<number> {
  let updated = 0;
  const cursor = collection.find({
    $or: fields.map((field) => ({ [`${field}Hi`]: { $exists: false } })),
  });
  for await (const doc of cursor) {
    const set: Record<string, unknown> = {};
    for (const field of fields) {
      if (!(`${field}Hi` in doc)) set[`${field}Hi`] = hindi(doc[field]);
    }
    extra?.(doc, set);
    await collection.updateOne({ _id: doc._id }, { $set: set });
    updated += 1;
  }
  return updated;
}

/**
 * Data migration 3: names, cities and addresses gain a Hindi version, and the
 * copies frozen onto sales, invoices and production entries follow. Records
 * are done before the copies so a sale takes its customer's Hindi name rather
 * than a second, possibly different, transliteration.
 */
export async function backfillHindiNames(db: Db): Promise<HindiBackfillCounts> {
  const counts: HindiBackfillCounts = {};

  counts.customers = await fillFields(
    db.collection('customers'),
    ['name', 'city', 'address'],
    (doc, set) => {
      // Search finds a customer by either script once both are stored.
      set.searchTerms = searchTerms(
        doc.name as string,
        (set.nameHi ?? doc.nameHi) as string | null,
        doc.city as string | null,
        (set.cityHi ?? doc.cityHi) as string | null,
        ...((doc.phones as string[] | undefined) ?? []),
      );
    },
  );
  counts.rawMaterials = await fillFields(db.collection('raw_materials'), ['name']);
  counts.products = await fillFields(db.collection('products'), ['name']);
  counts.users = await fillFields(db.collection('users'), ['name']);
  counts.organizations = await fillFields(db.collection('organizations'), [
    'name',
    'legalName',
    'address',
  ]);

  const customerHi = new Map<string, string | null>();
  for await (const doc of db.collection('customers').find({}, { projection: { nameHi: 1 } })) {
    customerHi.set(String(doc._id), (doc.nameHi as string | null) ?? null);
  }
  const productHi = new Map<string, string | null>();
  for await (const doc of db.collection('products').find({}, { projection: { nameHi: 1 } })) {
    productHi.set(String(doc._id), (doc.nameHi as string | null) ?? null);
  }

  let sales = 0;
  const salesCollection = db.collection('sales');
  const saleCursor = salesCollection.find({
    $or: [
      { customerNameHi: { $exists: false } },
      { 'seller.nameHi': { $exists: false } },
      { 'buyer.nameHi': { $exists: false } },
      { 'lines.productNameHi': { $exists: false } },
    ],
  });
  for await (const sale of saleCursor) {
    const seller = sale.seller as Record<string, unknown>;
    const buyer = sale.buyer as Record<string, unknown>;
    const lines = (sale.lines as Record<string, unknown>[]).map((line) => ({
      ...line,
      productNameHi:
        'productNameHi' in line
          ? line.productNameHi
          : (productHi.get(String(line.productId)) ?? hindi(line.productName)),
    }));
    await salesCollection.updateOne(
      { _id: sale._id },
      {
        $set: {
          customerNameHi:
            'customerNameHi' in sale
              ? sale.customerNameHi
              : (customerHi.get(String(sale.customerId)) ?? hindi(sale.customerName)),
          seller: {
            ...seller,
            nameHi: 'nameHi' in seller ? seller.nameHi : hindi(seller.name),
            addressHi: 'addressHi' in seller ? seller.addressHi : hindi(seller.address),
          },
          buyer: {
            ...buyer,
            nameHi:
              'nameHi' in buyer
                ? buyer.nameHi
                : (customerHi.get(String(sale.customerId)) ?? hindi(buyer.name)),
            addressHi: 'addressHi' in buyer ? buyer.addressHi : hindi(buyer.address),
          },
          lines,
        },
      },
    );
    sales += 1;
  }
  counts.sales = sales;

  let entries = 0;
  const entryCollection = db.collection('production_entries');
  for await (const entry of entryCollection.find({ productNameHi: { $exists: false } })) {
    await entryCollection.updateOne(
      { _id: entry._id },
      {
        $set: {
          productNameHi: productHi.get(String(entry.productId)) ?? hindi(entry.productName),
        },
      },
    );
    entries += 1;
  }
  counts.productionEntries = entries;

  return counts;
}
