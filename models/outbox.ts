import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';
import { OUTBOX_STATUSES, OUTBOX_TOPICS, type OutboxStatus, type OutboxTopic } from './constants';

/**
 * Transactional outbox. Side effects (email, webhooks out) are written in the
 * same transaction as the business change and drained by /api/cron/outbox, so a
 * crash between "order saved" and "email sent" loses nothing.
 */
export type OutboxDoc = {
  _id: ObjectId;
  topic: OutboxTopic;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const OutboxSchema = new Schema<OutboxDoc>(
  {
    topic: { type: String, enum: OUTBOX_TOPICS, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: OUTBOX_STATUSES, required: true, default: 'pending' },
    attempts: { type: Number, required: true, min: 0, default: 0 },
    nextAttemptAt: { type: Date, required: true, default: () => new Date() },
    lastError: { type: String, default: null, maxlength: 1000 },
  },
  { timestamps: true, collection: 'outbox', strict: 'throw' },
);

OutboxSchema.index({ status: 1, nextAttemptAt: 1 });
OutboxSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30, partialFilterExpression: { status: 'done' } },
);

export const Outbox: Model<OutboxDoc> =
  (models.Outbox as Model<OutboxDoc> | undefined) ?? model<OutboxDoc>('Outbox', OutboxSchema);
