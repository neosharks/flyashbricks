import 'server-only';
import { createHmac } from 'node:crypto';
import { env } from './env';
import { logger } from './logger';

export type TextChannel = 'sms' | 'whatsapp';

export type TextMessage = {
  /** Ten-digit Indian number; sent as +91… */
  phone: string;
  text: string;
  /** Lets the gateway pick its registered template. */
  type: string;
  link: string;
  locale: 'en' | 'hi';
};

function config(channel: TextChannel) {
  return channel === 'sms'
    ? { provider: env.SMS_PROVIDER, url: env.SMS_WEBHOOK_URL, secret: env.SMS_WEBHOOK_SECRET }
    : {
        provider: env.WHATSAPP_PROVIDER,
        url: env.WHATSAPP_WEBHOOK_URL,
        secret: env.WHATSAPP_WEBHOOK_SECRET,
      };
}

export function isTextChannelConfigured(channel: TextChannel): boolean {
  return config(channel).provider !== 'none';
}

/** `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`, the Stripe-style scheme gateways expect. */
export function signPayload(body: string, secret: string, timestamp: number): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

/**
 * Sends one SMS or WhatsApp message. Throws on failure so the outbox retries;
 * the caller records which channels already succeeded so nothing is sent twice.
 */
export async function sendText(channel: TextChannel, message: TextMessage): Promise<void> {
  const { provider, url, secret } = config(channel);

  if (provider === 'none') throw new Error(`${channel} is not configured`);

  if (provider === 'console') {
    logger.info(
      {
        channel,
        to: `+91${message.phone.slice(0, 2)}******${message.phone.slice(-2)}`,
        text: message.text,
      },
      `${channel} (console transport)`,
    );
    return;
  }

  if (!url || !secret) throw new Error(`${channel} webhook is not configured`);

  const body = JSON.stringify({
    channel,
    to: `+91${message.phone}`,
    text: message.text,
    type: message.type,
    link: message.link,
    locale: message.locale,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-FlyAsh-Signature': signPayload(body, secret, Math.floor(Date.now() / 1000)),
    },
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`${channel} gateway answered ${response.status}`);
  }
}
