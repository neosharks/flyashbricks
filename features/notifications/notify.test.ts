// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Types } from '@/lib/mongoose';
import { clearTestDb, startTestDb, stopTestDb, syncIndexes } from '@/tests/db';
import { aUser } from '@/tests/factories';
import { Notification } from '@/models/notification';
import { Outbox } from '@/models/outbox';
import { User } from '@/models/user';

const sendMail = vi.fn<(mail: { to: string[]; subject: string }) => Promise<void>>();
const sendText =
  vi.fn<(channel: string, message: { phone: string; text: string }) => Promise<void>>();

// The test connects Mongoose itself; the app's connector would look for MONGODB_URI.
vi.mock('@/lib/db', () => ({ connectDb: () => Promise.resolve() }));
vi.mock('@/lib/mailer', () => ({
  sendMail: (mail: { to: string[]; subject: string }) => sendMail(mail),
}));
vi.mock('@/lib/messaging', () => ({
  sendText: (channel: string, message: { phone: string; text: string }) =>
    sendText(channel, message),
  isTextChannelConfigured: () => true,
}));

const { notify } = await import('./notify');
const { deliverNotification } = await import('./deliver');

beforeAll(async () => {
  await startTestDb();
  await syncIndexes([Notification, User]);
}, 180_000);
afterEach(async () => {
  await clearTestDb();
  sendMail.mockReset();
  sendText.mockReset();
});
afterAll(stopTestDb);

const ORG = new Types.ObjectId();

describe('notify', () => {
  it('reaches everyone allowed to see it, and nobody else', async () => {
    const admin = await aUser(ORG);
    const sales = await aUser(ORG, { role: 'employee', permissions: { sales: 'read' } });
    const yard = await aUser(ORG, { role: 'employee', permissions: { production: 'write' } });
    await aUser(new Types.ObjectId()); // an admin of another company

    const created = await notify({
      orgId: ORG.toString(),
      type: 'payment_received',
      params: { number: 'S-0001', customer: 'Ramesh', amountPaise: 50_000 },
      href: '/sales/abc',
    });

    expect(created).toBe(2);
    const recipients = (await Notification.find().lean()).map((n) => n.userId.toString()).sort();
    expect(recipients).toEqual([admin._id.toString(), sales._id.toString()].sort());
    expect(recipients).not.toContain(yard._id.toString());
  });

  it('leaves out the person who did it and anyone disabled', async () => {
    const actor = await aUser(ORG);
    await aUser(ORG, { disabled: true });
    const other = await aUser(ORG);

    await notify({
      orgId: ORG.toString(),
      type: 'sale_created',
      params: {},
      href: '/sales/x',
      excludeUserId: actor._id.toString(),
    });

    const recipients = (await Notification.find().lean()).map((n) => n.userId.toString());
    expect(recipients).toEqual([other._id.toString()]);
  });

  it('sends a daily digest at most once per person', async () => {
    await aUser(ORG);
    const input = {
      orgId: ORG.toString(),
      type: 'payments_overdue' as const,
      params: { count: 3, amountPaise: 9_000, days: 30 },
      href: '/sales',
      dedupeKey: 'payments_overdue:2026-10-12',
    };
    expect(await notify(input)).toBe(1);
    expect(await notify(input)).toBe(0);
    expect(await Notification.countDocuments()).toBe(1);
  });

  it('refuses a link that leaves the app', async () => {
    await expect(
      notify({
        orgId: ORG.toString(),
        type: 'sale_created',
        params: {},
        href: 'https://evil.example',
      }),
    ).rejects.toThrow();
    await expect(
      notify({ orgId: ORG.toString(), type: 'sale_created', params: {}, href: '//evil.example' }),
    ).rejects.toThrow();
  });

  it('queues outside delivery only for people who chose a channel', async () => {
    // Admin defaults: stock alerts by email. A sales clerk defaults to in-app only.
    await aUser(ORG, { email: 'owner@example.com' });
    await aUser(ORG, { role: 'employee', permissions: { rawMaterials: 'read' } });

    await notify({
      orgId: ORG.toString(),
      type: 'material_low',
      params: { name: 'Cement', qtyMilli: 2_000, unit: 'bag' },
      href: '/raw-materials/1',
    });

    expect(await Notification.countDocuments()).toBe(2);
    // The employee's default stock preference is also email, but they have no address
    // to send to yet; delivery is still queued and skipped at send time.
    expect(await Outbox.countDocuments({ topic: 'notification.deliver' })).toBe(2);
  });
});

describe('deliverNotification', () => {
  async function oneNotification(prefs: { email: boolean; sms: boolean; whatsapp: boolean }) {
    const user = await aUser(ORG, { email: 'owner@example.com' });
    await User.updateOne(
      { _id: user._id },
      { $set: { 'notificationPrefs.payments': prefs, locale: 'hi' } },
    );
    await notify({
      orgId: ORG.toString(),
      type: 'payment_received',
      params: { number: 'S-0007', customer: 'Ramesh', amountPaise: 125_000 },
      href: '/sales/abc',
    });
    const notification = await Notification.findOne().lean();
    return notification?._id.toString() ?? '';
  }

  it('sends on each chosen channel, in the reader’s language, with a deep link', async () => {
    const id = await oneNotification({ email: true, sms: true, whatsapp: false });
    await deliverNotification(id);

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0]?.[0].subject).toContain('पैसे मिले');
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0]?.[0]).toBe('sms');
    expect(sendText.mock.calls[0]?.[1].text).toContain(`/n/${id}`);

    const stored = await Notification.findById(id).lean();
    expect(stored?.deliveries.map((d) => [d.channel, d.status]).sort()).toEqual([
      ['email', 'sent'],
      ['sms', 'sent'],
    ]);
  });

  it('retries only the channel that failed', async () => {
    const id = await oneNotification({ email: true, sms: true, whatsapp: false });
    sendText.mockRejectedValueOnce(new Error('gateway down'));

    await expect(deliverNotification(id)).rejects.toThrow(/sms/);
    expect(sendMail).toHaveBeenCalledTimes(1);

    await deliverNotification(id);
    // Email is not sent a second time; SMS is.
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendText).toHaveBeenCalledTimes(2);
    const stored = await Notification.findById(id).lean();
    expect(stored?.deliveries.find((d) => d.channel === 'sms')?.status).toBe('sent');
  });

  it('sends nothing to someone who chose the app only', async () => {
    const id = await oneNotification({ email: false, sms: false, whatsapp: false });
    await deliverNotification(id);
    expect(sendMail).not.toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
  });
});
