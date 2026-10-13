import 'server-only';
import { createTranslator } from 'next-intl';
import { connectDb } from '@/lib/db';
import { sendMail } from '@/lib/mailer';
import { sendText } from '@/lib/messaging';
import { publicEnv } from '@/lib/public-env';
import { loadMessages } from '@/i18n/messages';
import { User } from '@/models/user';
import { Notification, type Delivery } from '@/models/notification';
import type { NotificationChannel, OutboxTopic } from '@/models/constants';
import { displayParams, renderNotification, type Translate } from './render';
import { resolvePrefs } from './prefs';
import { availableChannels } from './channels';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
}

/** The link in every email and text: opens the record after sign-in, and marks it read. */
export function notificationLink(id: string): string {
  return `${publicEnv.APP_URL}/n/${id}`;
}

async function translatorFor(locale: 'en' | 'hi') {
  const messages = await loadMessages(locale);
  const t = createTranslator({
    locale,
    messages,
    namespace: 'notifications',
  }) as unknown as Translate;
  const units = createTranslator({
    locale,
    messages,
    namespace: 'common.units',
  }) as unknown as Translate;
  return { t, unitLabel: (unit: string) => units(unit) };
}

/**
 * Sends one notification to the channels its recipient chose. Each channel is
 * recorded as it succeeds, so when the outbox retries after a failure, only
 * the channels that failed are tried again — nobody gets the same SMS twice.
 */
export async function deliverNotification(notificationId: string): Promise<void> {
  await connectDb();
  const notification = await Notification.findById(notificationId).lean();
  if (!notification) return;

  const user = await User.findById(notification.userId)
    .select('name email phone role locale notificationPrefs disabledAt')
    .lean();
  if (!user || user.disabledAt) return;

  const prefs = resolvePrefs(user.notificationPrefs, user.role)[notification.category];
  const available = availableChannels();
  const done = new Set(
    notification.deliveries.filter((d) => d.status !== 'failed').map((d) => d.channel),
  );

  const locale = user.locale;
  const { t, unitLabel } = await translatorFor(locale);
  const params = displayParams(notification.params, locale, unitLabel);
  const { title, body } = renderNotification(t, notification.type, params);
  const link = notificationLink(notification._id.toString());

  const attempts: { channel: NotificationChannel; send: () => Promise<void> }[] = [];
  if (prefs.email && available.email && user.email) {
    attempts.push({
      channel: 'email',
      send: () =>
        sendMail({
          to: [user.email ?? ''],
          subject: title,
          text: `${body}\n\n${t('email.open')}: ${link}`,
          html: `<!doctype html><html lang="${locale}"><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#2a2622;max-width:560px">
<h1 style="font-size:18px;margin:0 0 8px">${escapeHtml(title)}</h1>
<p style="margin:0 0 16px">${escapeHtml(body)}</p>
<p><a href="${link}" style="display:inline-block;background:#a8432a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${escapeHtml(t('email.open'))}</a></p>
<p style="color:#888;font-size:12px">${escapeHtml(publicEnv.NEXT_PUBLIC_APP_NAME)} · ${escapeHtml(t('email.footer'))}</p>
</body></html>`,
        }),
    });
  }
  for (const channel of ['sms', 'whatsapp'] as const) {
    if (prefs[channel] && available[channel]) {
      attempts.push({
        channel,
        send: () =>
          sendText(channel, {
            phone: user.phone,
            text: `${title}: ${body} ${link}`,
            type: notification.type,
            link,
            locale,
          }),
      });
    }
  }

  const failures: string[] = [];
  for (const attempt of attempts) {
    if (done.has(attempt.channel)) continue;
    let delivery: Delivery;
    try {
      await attempt.send();
      delivery = { channel: attempt.channel, status: 'sent', at: new Date(), error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${attempt.channel}: ${message}`);
      delivery = {
        channel: attempt.channel,
        status: 'failed',
        at: new Date(),
        error: message.slice(0, 300),
      };
    }
    // Replace any earlier failed record for this channel with the latest attempt.
    await Notification.updateOne(
      { _id: notification._id },
      { $pull: { deliveries: { channel: attempt.channel } } },
    );
    await Notification.updateOne({ _id: notification._id }, { $push: { deliveries: delivery } });
  }

  if (failures.length > 0) throw new Error(`notification delivery failed — ${failures.join('; ')}`);
}

const HANDLERS: Record<OutboxTopic, (payload: Record<string, unknown>) => Promise<void>> = {
  'notification.deliver': (payload) => deliverNotification(String(payload.notificationId)),
};

export function handleOutboxTopic(
  topic: OutboxTopic,
  payload: Record<string, unknown>,
): Promise<void> {
  return HANDLERS[topic](payload);
}
