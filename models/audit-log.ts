import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';

/** Append-only record of who changed what. Never updated, never deleted by the app. */
export type AuditLogDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  actorUserId: ObjectId | null;
  /** Copied so the log stays readable after the user is renamed or disabled. */
  actorName: string | null;
  /** `<entity>.<verb>`, e.g. `sale.create`. Translated for display. */
  action: string;
  entity: string;
  entityId: string;
  /** Changed fields only, already free of secrets. Never whole documents. */
  changes: Record<string, unknown> | null;
  ip: string | null;
  traceId: string | null;
  createdAt: Date;
};

const AuditLogSchema = new Schema<AuditLogDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: null, maxlength: 120 },
    action: { type: String, required: true, maxlength: 80 },
    entity: { type: String, required: true, maxlength: 40 },
    entityId: { type: String, required: true, maxlength: 60 },
    changes: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: null, maxlength: 64 },
    traceId: { type: String, default: null, maxlength: 64 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_logs', strict: 'throw' },
);

AuditLogSchema.index({ orgId: 1, createdAt: -1, _id: -1 });
AuditLogSchema.index({ orgId: 1, entity: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ orgId: 1, actorUserId: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 730 });

export const AuditLog: Model<AuditLogDoc> =
  (models.AuditLog as Model<AuditLogDoc> | undefined) ??
  model<AuditLogDoc>('AuditLog', AuditLogSchema);
