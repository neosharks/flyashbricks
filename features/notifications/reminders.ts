import 'server-only';
import { Types } from '@/lib/mongoose';
import { connectDb } from '@/lib/db';
import { addDays, DEFAULT_TIMEZONE, startOfDay, todayKey } from '@/lib/dates';
import { Organization } from '@/models/organization';
import { Sale } from '@/models/sale';
import { notify } from './notify';

/** Bills older than this with money still pending are "overdue". */
export const OVERDUE_AFTER_DAYS = 30;

/**
 * One digest per organisation per day: "N bills have been pending for more
 * than 30 days (₹X)". A digest rather than one alert per bill, so a yard with
 * forty slow payers is reminded, not buried. Safe to run more than once a day:
 * the dedupe key makes the second run a no-op.
 */
export async function sendOverdueReminders(now = new Date()): Promise<number> {
  await connectDb();
  const orgs = await Organization.find().select('timezone').lean();
  let notified = 0;

  for (const org of orgs) {
    const timezone = org.timezone || DEFAULT_TIMEZONE;
    const today = todayKey(timezone, now);
    const cutoff = startOfDay(addDays(today, -OVERDUE_AFTER_DAYS), timezone);

    const [summary] = await Sale.aggregate<{ count: number; duePaise: number }>([
      {
        $match: {
          orgId: new Types.ObjectId(org._id),
          voidedAt: null,
          duePaise: { $gt: 0 },
          date: { $lt: cutoff },
        },
      },
      { $group: { _id: null, count: { $sum: 1 }, duePaise: { $sum: '$duePaise' } } },
    ]);
    if (!summary || summary.count === 0) continue;

    notified += await notify({
      orgId: org._id.toString(),
      type: 'payments_overdue',
      params: { count: summary.count, amountPaise: summary.duePaise, days: OVERDUE_AFTER_DAYS },
      href: '/sales?status=due&sort=date&dir=asc',
      dedupeKey: `payments_overdue:${today}`,
    });
  }
  return notified;
}
