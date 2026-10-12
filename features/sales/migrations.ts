import type { mongo } from 'mongoose';
import { averageRate } from './totals';

/**
 * Data migration 2: sales made before brick prices were tracked get their
 * average rate per brick and, per line, the usual price. The usual price at
 * the time is unknown, so the line's own rate stands in — such bills simply
 * show no discount or premium. Idempotent: only documents still missing the
 * fields are touched, so it can be re-run safely.
 */
export async function backfillSaleRates(sales: mongo.Collection): Promise<number> {
  let updated = 0;
  const cursor = sales.find(
    {
      $or: [{ avgRatePaise: { $exists: false } }, { 'lines.defaultRatePaise': { $exists: false } }],
    },
    { projection: { subtotalPaise: 1, bricks: 1, lines: 1 } },
  );

  for await (const sale of cursor) {
    const lines = (sale.lines as { ratePaise: number; defaultRatePaise?: number }[]).map(
      (line) => ({
        ...line,
        defaultRatePaise: line.defaultRatePaise ?? line.ratePaise,
      }),
    );
    await sales.updateOne(
      { _id: sale._id },
      {
        $set: {
          lines,
          avgRatePaise: averageRate(Number(sale.subtotalPaise), Number(sale.bricks)),
        },
      },
    );
    updated += 1;
  }
  return updated;
}
