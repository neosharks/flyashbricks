import 'server-only';
import { env } from '@/lib/env';
import { isTextChannelConfigured } from '@/lib/messaging';
import type { NotificationChannel } from '@/models/constants';

/**
 * Which channels can actually deliver right now. A preference for a channel
 * that is not set up is kept, and starts working the day it is configured.
 */
export function availableChannels(): Record<NotificationChannel, boolean> {
  return {
    // The console transport counts in development, so the whole flow is visible in the log.
    email: env.MAIL_TRANSPORT === 'smtp' || env.NODE_ENV !== 'production',
    sms: isTextChannelConfigured('sms'),
    whatsapp: isTextChannelConfigured('whatsapp'),
  };
}
