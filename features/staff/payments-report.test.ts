// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Types, type ObjectId } from '@/lib/mongoose';
import { startOfDay } from '@/lib/dates';
import { NO_ACCESS, type SessionUser } from '@/lib/permissions';
import { clearTestDb, startTestDb, stopTestDb, syncIndexes } from '@/tests/db';
import { StaffMember } from '@/models/staff-member';
import { StaffPayment } from '@/models/staff-payment';
import type { PaymentMode, StaffPaymentType, StaffRole } from '@/models/constants';

vi.mock('@/lib/db', () => ({ connectDb: () => Promise.resolve() }));

const report = await import('./payments-report');

const TZ = 'Asia/Kolkata';
const NOW = new Date('2026-10-12T06:00:00Z');

beforeAll(async () => {
  await startTestDb();
  await syncIndexes([StaffMember, StaffPayment]);
}, 180_000);
afterEach(clearTestDb);
afterAll(stopTestDb);

function viewerOf(orgId: ObjectId): SessionUser {
  return {
    id: new Types.ObjectId().toString(),
    orgId: orgId.toString(),
    name: 'Owner',
    role: 'admin',
    permissions: NO_ACCESS,
    mustChangePassword: false,
  };
}

async function worker(orgId: ObjectId, name: string, role: StaffRole = 'labour') {
  return StaffMember.create({
    orgId,
    name,
    role,
    searchTerms: name.toLowerCase().split(' '),
    createdBy: new Types.ObjectId(),
  });
}

async function pay(
  orgId: ObjectId,
  staffId: ObjectId,
  type: StaffPaymentType,
  rupees: number,
  paidOn: Date,
  options: { mode?: PaymentMode; voided?: boolean } = {},
) {
  return StaffPayment.create({
    orgId,
    staffId,
    type,
    amountPaise: rupees * 100,
    mode: options.mode ?? 'cash',
    paidOn,
    voidedAt: options.voided ? new Date() : null,
    voidReason: options.voided ? 'Entered twice' : null,
    recordedBy: new Types.ObjectId(),
    recordedByName: 'Owner',
  });
}

const thisMonth = (query: Record<string, string> = {}) =>
  report.parsePaymentsFilters(query, TZ, NOW);

describe('period parsing', () => {
  it('knows the presets, with weeks from Monday and the year from 1 April', () => {
    expect(thisMonth()).toMatchObject({ from: '2026-10-01', to: '2026-10-12' });
    expect(thisMonth({ period: 'week' })).toMatchObject({ from: '2026-10-12', to: '2026-10-12' });
    expect(thisMonth({ period: 'lastMonth' })).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(thisMonth({ period: 'last30' })).toMatchObject({ from: '2026-09-13', to: '2026-10-12' });
    expect(thisMonth({ period: 'year' })).toMatchObject({ from: '2026-04-01', to: '2026-10-12' });
    expect(report.previousRange('2026-10-01', '2026-10-12')).toEqual({
      from: '2026-09-19',
      to: '2026-09-30',
    });
  });
});

describe('payment totals', () => {
  it('adds up by type, leaves cancelled payments out, and counts people paid', async () => {
    const org = new Types.ObjectId();
    const a = await worker(org, 'Ajay Kumar');
    const b = await worker(org, 'Bhola Ram');
    const day = startOfDay('2026-10-05', TZ);
    await pay(org, a._id, 'wage', 5_000, day);
    await pay(org, a._id, 'advance', 1_000, day, { mode: 'upi' });
    await pay(org, a._id, 'deduction', 200, day);
    await pay(org, b._id, 'bonus', 500, day);
    await pay(org, b._id, 'wage', 9_999, day, { voided: true });

    const filters = thisMonth();
    const facts = await report.paymentFacts(viewerOf(org), filters, '', filters, TZ);
    const summary = report.summarizeFacts(facts);
    expect(summary).toMatchObject({
      wage: 500_000,
      advance: 100_000,
      bonus: 50_000,
      deduction: 20_000,
      paidOut: 650_000,
      people: 2,
      payments: 4,
      averagePerPerson: 325_000,
    });
  });

  it('counts a payment on the day it was made in India, not in UTC', async () => {
    const org = new Types.ObjectId();
    const a = await worker(org, 'Ajay Kumar');
    // 1 Oct 00:30 IST is still 30 Sep in UTC.
    await pay(org, a._id, 'wage', 100, new Date('2026-09-30T19:00:00Z'));
    // 30 Sep 23:30 IST belongs to September.
    await pay(org, a._id, 'wage', 7, new Date('2026-09-30T18:00:00Z'));

    const filters = thisMonth();
    const facts = await report.paymentFacts(viewerOf(org), filters, '', filters, TZ);
    expect(report.summarizeFacts(facts).wage).toBe(10_000);
    expect(facts[0]?.day).toBe('2026-10-01');
  });

  it('never includes another organisation’s payments', async () => {
    const mine = new Types.ObjectId();
    const theirs = new Types.ObjectId();
    const a = await worker(mine, 'Ajay Kumar');
    const b = await worker(theirs, 'Ajay Kumar');
    await pay(mine, a._id, 'wage', 100, startOfDay('2026-10-02', TZ));
    await pay(theirs, b._id, 'wage', 9_000, startOfDay('2026-10-02', TZ));

    const filters = thisMonth();
    const facts = await report.paymentFacts(viewerOf(mine), filters, '', filters, TZ);
    expect(report.summarizeFacts(facts).paidOut).toBe(10_000);
  });

  it('narrows by role, person name and type', async () => {
    const org = new Types.ObjectId();
    const driver = await worker(org, 'Kailash Jat', 'driver');
    const labour = await worker(org, 'Mahesh Yadav', 'labour');
    const day = startOfDay('2026-10-03', TZ);
    await pay(org, driver._id, 'wage', 300, day);
    await pay(org, labour._id, 'wage', 200, day);
    await pay(org, labour._id, 'advance', 50, day);

    const viewer = viewerOf(org);
    const byRole = thisMonth({ role: 'driver' });
    expect(
      report.summarizeFacts(await report.paymentFacts(viewer, byRole, '', byRole, TZ)).paidOut,
    ).toBe(30_000);
    const all = thisMonth();
    expect(
      report.summarizeFacts(await report.paymentFacts(viewer, all, 'mahesh', all, TZ)).paidOut,
    ).toBe(25_000);
    const advances = thisMonth({ type: 'advance' });
    expect(
      report.summarizeFacts(await report.paymentFacts(viewer, advances, '', advances, TZ)).paidOut,
    ).toBe(5_000);
  });
});

describe('grouping and chart buckets', () => {
  it('subtotals per person and per week, net of deductions', async () => {
    const org = new Types.ObjectId();
    const a = await worker(org, 'Ajay Kumar');
    const b = await worker(org, 'Bhola Ram', 'driver');
    await pay(org, a._id, 'wage', 1_000, startOfDay('2026-10-05', TZ));
    await pay(org, a._id, 'deduction', 100, startOfDay('2026-10-06', TZ));
    await pay(org, b._id, 'wage', 500, startOfDay('2026-10-12', TZ));

    const filters = thisMonth();
    const facts = await report.paymentFacts(viewerOf(org), filters, '', filters, TZ);
    const roles = new Map([
      [a._id.toString(), 'labour' as const],
      [b._id.toString(), 'driver' as const],
    ]);

    const byPerson = report.groupFacts(facts, 'person', (id) => roles.get(id) ?? null);
    expect(byPerson.map((row) => [row.key, row.net, row.payments])).toEqual([
      [a._id.toString(), 90_000, 2],
      [b._id.toString(), 50_000, 1],
    ]);

    const byWeek = report.groupFacts(facts, 'week', () => null);
    expect(byWeek.map((row) => [row.key, row.wage])).toEqual(
      expect.arrayContaining([
        ['2026-10-05', 100_000],
        ['2026-10-12', 50_000],
      ]),
    );
    expect(
      report
        .groupFacts(facts, 'role', (id) => roles.get(id) ?? null)
        .map((row) => row.key)
        .sort(),
    ).toEqual(['driver', 'labour']);

    const days = report.bucketFacts(facts, '2026-10-01', '2026-10-12', 'day');
    expect(days).toHaveLength(12);
    expect(days.find((bucket) => bucket.key === '2026-10-05')?.wage).toBe(100_000);
    expect(report.bucketUnit('2026-04-01', '2026-10-12')).toBe('month');
  });
});

describe('payments table', () => {
  it('pages through every payment, cancelled ones included, and sorts by person', async () => {
    const org = new Types.ObjectId();
    const zed = await worker(org, 'Zakir Khan');
    const amit = await worker(org, 'Amit Singh');
    const day = startOfDay('2026-10-04', TZ);
    await pay(org, zed._id, 'wage', 100, day);
    await pay(org, amit._id, 'wage', 200, day, { voided: true });
    await pay(org, amit._id, 'bonus', 50, day);

    const filters = thisMonth();
    const base = { q: '', after: null, before: null, size: 2 };
    const first = await report.listPayments(
      viewerOf(org),
      filters,
      { ...base, sort: 'person', dir: 'asc' },
      TZ,
    );
    expect(first.rows.map((row) => row.staff?.name)).toEqual(['Amit Singh', 'Amit Singh']);
    expect(first.rows.some((row) => row.voided)).toBe(true);
    expect(first.next).not.toBeNull();

    const second = await report.listPayments(
      viewerOf(org),
      filters,
      { ...base, sort: 'person', dir: 'asc', after: first.next },
      TZ,
    );
    expect(second.rows.map((row) => row.staff?.name)).toEqual(['Zakir Khan']);
    expect(second.prev).not.toBeNull();
  });
});

describe('per-person chart', () => {
  it('covers the last twelve months, oldest first', async () => {
    const org = new Types.ObjectId();
    const a = await worker(org, 'Ajay Kumar');
    await pay(org, a._id, 'wage', 100, startOfDay('2026-03-10', TZ));
    await pay(org, a._id, 'advance', 40, startOfDay('2025-12-01', TZ));

    const months = await report.staffPaidByMonth(viewerOf(org), a._id.toString(), TZ, NOW);
    expect(months).toHaveLength(12);
    expect(months[0]?.key).toBe('2025-11');
    expect(months.at(-1)?.key).toBe('2026-10');
    expect(months.find((bucket) => bucket.key === '2026-03')?.wage).toBe(10_000);
    expect(months.find((bucket) => bucket.key === '2025-12')?.advance).toBe(4_000);
  });
});
