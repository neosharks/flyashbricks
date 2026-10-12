# Notifications

Every alert lands in the in-app inbox (the bell). Each person also chooses,
per kind of alert, whether they want it by email, SMS or WhatsApp
(**Notifications → Choose alerts**). Emails and texts are written in that
person's language and carry a link that opens the exact record.

## What triggers a notification

| Type               | When                                                   | Who gets it                    | Opens         |
| ------------------ | ------------------------------------------------------ | ------------------------------ | ------------- |
| `material_low`     | A raw material drops to its order level (once per dip) | Raw materials access           | The material  |
| `bricks_low`       | Bricks ready to sell drop to the alert level           | Production access              | Brick stock   |
| `sale_created`     | A sale is saved                                        | Sales access (not the creator) | The bill      |
| `sale_voided`      | A bill is cancelled                                    | Sales access (not the creator) | The bill      |
| `payment_received` | Money is recorded against a bill                       | Sales access (not the creator) | The bill      |
| `payments_overdue` | Daily, 09:00 IST: bills pending over 30 days           | Sales access                   | Pending bills |
| `employee_added`   | An employee account is created                         | Employees access               | The employee  |
| `backup_failed`    | The nightly backup fails                               | Admins                         | Backup page   |

## How it works

1. A business change calls `notify()` (`features/notifications/notify.ts`)
   **inside its transaction**: one inbox row per recipient, plus an outbox job
   when that person wants email/SMS/WhatsApp. A rolled-back sale announces nothing.
2. `/api/cron/outbox` (every minute) runs `deliverNotification`, which sends
   each chosen channel and records the result per channel. A failed channel is
   retried with backoff; channels that already succeeded are never re-sent.
3. Links are `/n/<id>`: signed-out people sign in first and come back; the
   page marks the notification read (POST) and replaces itself with the record.
   Someone else's notification id is a 404.

## Setting up channels

- **Email**: `MAIL_TRANSPORT=smtp` and `SMTP_URL` (see `.env.example`).
- **SMS / WhatsApp**: `SMS_PROVIDER=webhook` (or `WHATSAPP_PROVIDER=webhook`)
  with `*_WEBHOOK_URL` and `*_WEBHOOK_SECRET`. Use `console` in development.

The app POSTs JSON to your gateway (MSG91, Gupshup, Twilio, an automation
service…):

```json
{
  "channel": "sms",
  "to": "+919876543210",
  "text": "…",
  "type": "payment_received",
  "link": "https://bricks.example.com/n/6acc…",
  "locale": "hi"
}
```

with header `X-FlyAsh-Signature: t=<unix seconds>,v1=<hex>` where `v1` is
HMAC-SHA256 of `"<t>.<raw body>"` using the secret. Verify it, and reject
timestamps older than five minutes. Any non-2xx answer is retried.

Indian SMS must use DLT-registered templates: register one template per
`type` with your provider and map `type` to it in the gateway.

## Adding a notification type

Add it to `NOTIFICATION_TYPES` (`models/constants.ts`), give it a category,
severity and audience in `features/notifications/registry.ts` (the compiler
insists), add `notifications.types.<type>.title/body` in both languages, and
call `notify()` from the write that causes it.
