import 'server-only';
import type { ObjectId } from '@/lib/mongoose';
import { logger } from '@/lib/logger';
import { requestInfo } from '@/lib/request-info';
import { User } from '@/models/user';
import { LoginEvent } from '@/models/login-event';

export async function recordLogin(
  user: { _id: ObjectId; orgId: ObjectId },
  success: boolean,
  reason: string | null,
  method: 'password' | 'pin' = 'password',
): Promise<void> {
  try {
    const { ip, userAgent } = await requestInfo();
    await LoginEvent.create({
      orgId: user.orgId,
      userId: user._id,
      success,
      method,
      reason,
      ip,
      userAgent,
    });
    if (success) await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  } catch (err) {
    // A failed history write must not lock someone out of their account.
    logger.error({ err }, 'failed to record login event');
  }
}
