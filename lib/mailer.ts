import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { env } from './env';
import { logger } from './logger';

export type MailAttachment = { filename: string; content: Buffer; contentType: string };

export type Mail = {
  to: string[];
  subject: string;
  text: string;
  html: string;
  attachments?: MailAttachment[];
};

export type MailTransport = { send(mail: Mail): Promise<void> };

/**
 * Development transport: writes the message to the log instead of sending it,
 * so local work needs no mail credentials.
 */
const consoleTransport: MailTransport = {
  send: (mail) => {
    logger.info(
      {
        to: mail.to,
        subject: mail.subject,
        // Message bodies carry customer names and amounts; keep them out of production logs.
        ...(env.NODE_ENV === 'production' ? {} : { body: mail.text }),
        attachments: mail.attachments?.map((file) => ({
          filename: file.filename,
          bytes: file.content.length,
        })),
      },
      'email (console transport)',
    );
    return Promise.resolve();
  },
};

const globalCache = globalThis as typeof globalThis & { _smtp?: Transporter };

function smtpTransport(): MailTransport {
  const options: SMTPTransport.Options = {
    url: env.SMTP_URL ?? '',
    // A hung mail server must not hold the outbox run open indefinitely.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  };
  globalCache._smtp ??= nodemailer.createTransport(options);
  const transporter = globalCache._smtp;

  return {
    send: async (mail) => {
      await transporter.sendMail({
        from: env.MAIL_FROM,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        ...(mail.attachments ? { attachments: mail.attachments } : {}),
      });
    },
  };
}

export function getMailTransport(): MailTransport {
  return env.MAIL_TRANSPORT === 'smtp' ? smtpTransport() : consoleTransport;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (mail.to.length === 0) return;
  await getMailTransport().send(mail);
}
