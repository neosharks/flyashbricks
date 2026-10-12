import { Schema, model, models, type Model, type ClientSession } from '@/lib/mongoose';

/**
 * Per-organisation sequences for human-readable numbers (sale S-0001). Sales
 * are internal to one company, so a sequential number discloses nothing and is
 * what people expect to read out over the phone.
 */
export type CounterDoc = { _id: string; seq: number };

const CounterSchema = new Schema<CounterDoc>(
  { _id: { type: String, required: true }, seq: { type: Number, required: true, default: 0 } },
  { collection: 'counters', strict: 'throw', versionKey: false },
);

export const Counter: Model<CounterDoc> =
  (models.Counter as Model<CounterDoc> | undefined) ?? model<CounterDoc>('Counter', CounterSchema);

/** Atomic increment; inside the caller's transaction so a rolled-back sale returns its number. */
export async function nextSequence(
  orgId: string,
  name: string,
  session?: ClientSession,
): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: `${orgId}:${name}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', ...(session ? { session } : {}) },
  ).lean();
  return doc.seq;
}
