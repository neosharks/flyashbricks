import 'server-only';
import { Types, type ClientSession } from '@/lib/mongoose';
import { AuditLog } from '@/models/audit-log';
import { currentTraceId, logger } from './logger';
import { requestInfo } from './request-info';
import type { SessionUser } from './permissions';

type AuditInput = {
  actor: SessionUser;
  /** `<entity>.<verb>`; the activity page translates it. */
  action: string;
  entity: string;
  entityId: string;
  /** Changed fields only, already free of secrets. */
  changes?: Record<string, unknown>;
};

/**
 * Records who did what. Inside a transaction it is written with the business
 * change, so the log can never claim something that was rolled back.
 * Outside one it never throws: a failed audit write must not undo the action.
 */
export async function recordAudit(input: AuditInput, session?: ClientSession): Promise<void> {
  const doc = {
    orgId: new Types.ObjectId(input.actor.orgId),
    actorUserId: new Types.ObjectId(input.actor.id),
    actorName: input.actor.name,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    changes: input.changes ?? null,
    ip: (await requestInfo()).ip,
    traceId: currentTraceId(),
  };

  if (session) {
    await AuditLog.create([doc], { session });
    return;
  }

  try {
    await AuditLog.create(doc);
  } catch (err) {
    logger.error({ err, action: input.action }, 'failed to write audit log');
  }
}
