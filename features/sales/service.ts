import 'server-only';
import { Types, type ClientSession } from '@/lib/mongoose';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { recordAudit } from '@/lib/audit';
import { inTransaction } from '@/lib/transaction';
import { formatSaleNumber } from '@/lib/ids';
import { startOfDay, todayKey } from '@/lib/dates';
import { can, type SessionUser } from '@/lib/permissions';
import { applyStockChange } from '@/features/stock/ledger';
import { createCustomer } from '@/features/customers/service';
import { notify } from '@/features/notifications/notify';
import { Customer, type CustomerDoc } from '@/models/customer';
import { nextSequence } from '@/models/counter';
import { Product } from '@/models/product';
import { Organization, type OrganizationDoc } from '@/models/organization';
import { Sale, type InvoiceBuyer, type SaleDoc, type SaleLine } from '@/models/sale';
import { invoiceSequence, saleTax, sellerSnapshot } from '@/lib/invoice';
import { completeBilingual } from '@/lib/bilingual';
import { averageRate, computeSaleTotals, paymentStatus } from './totals';
import type { AddPaymentInput, CreateSaleInput, VoidSaleInput } from './schema';

/**
 * The transactional cores of selling. Each one is a single MongoDB transaction
 * that moves stock, money on the sale, and the customer's running totals
 * together — so the customer list, the sale and the stock ledger can never
 * disagree, even if the process dies half-way.
 *
 * They re-check permission themselves; the Server Actions are thin wrappers.
 */

function assertCan(actor: SessionUser, action: 'sales:write' | 'sales:void'): void {
  if (!can(actor, action)) throw new ForbiddenError();
}

function assertNotFuture(key: string, timeZone: string, field: string): void {
  if (key > todayKey(timeZone))
    throw new ValidationError('Future date', { [field]: ['futureDate'] });
}

export async function createSale(
  actor: SessionUser,
  input: CreateSaleInput,
  timeZone: string,
): Promise<{ id: string; number: number }> {
  assertCan(actor, 'sales:write');
  assertNotFuture(input.date, timeZone, 'date');

  const orgId = new Types.ObjectId(actor.orgId);
  const products = await Product.find({
    orgId,
    _id: { $in: input.lines.map((line) => new Types.ObjectId(line.productId)) },
  })
    .select('name nameHi isActive stockGood defaultRatePaise')
    .lean();
  const byId = new Map(products.map((product) => [product._id.toString(), product]));

  // Checked here so the form can point at the line; the conditional update in
  // the stock ledger is what actually prevents overselling under a race.
  const fields: Record<string, string[]> = {};
  input.lines.forEach((line, index) => {
    const product = byId.get(line.productId);
    if (!product?.isActive) fields[`lines.${index}.productId`] = ['invalid'];
    else if (product.stockGood < line.qty) fields[`lines.${index}.qty`] = ['notEnoughStock'];
  });
  if (Object.keys(fields).length > 0) throw new ValidationError('Invalid lines', fields);

  const computed = computeSaleTotals({
    lines: input.lines.map((line) => ({ qty: line.qty, ratePaise: line.rate })),
    deliveryPaise: input.delivery,
    discountPaise: input.discount,
  });
  if (!computed.ok) {
    throw new ValidationError('Invalid totals', {
      [computed.error === 'discountTooLarge' ? 'discount' : '_form']: [computed.error],
    });
  }
  const { totals } = computed;

  const date = startOfDay(input.date, timeZone);
  const saleId = new Types.ObjectId();
  const now = new Date();

  // Either script may have been typed for a walk-in customer; each fills the other.
  const newCustomerName = completeBilingual(input.newCustomerName, input.newCustomerNameHi);

  const number = await inTransaction(async (session) => {
    const customer: CustomerDoc | null =
      input.customerMode === 'existing'
        ? await Customer.findOne({ _id: new Types.ObjectId(input.customerId), orgId })
            .session(session)
            .lean<CustomerDoc>()
        : await createCustomer(
            actor,
            {
              name: newCustomerName.en ?? '',
              nameHi: newCustomerName.hi,
              phones: [input.newCustomerPhone ?? ''],
              address: input.deliveryAddress,
              addressHi: completeBilingual(input.deliveryAddress, null).hi,
              city: null,
              cityHi: null,
              gstin: null,
              stateCode: null,
              notes: null,
            },
            session,
          );
    if (!customer) throw new NotFoundError('Customer');

    const org = await Organization.findById(orgId).session(session).lean<OrganizationDoc>();
    if (!org) throw new NotFoundError('Organization');

    // Frozen onto the sale: a later change of address, GSTIN or rate must
    // never alter an invoice that has already been issued.
    const seller = sellerSnapshot(org);
    const deliveryAddress = input.deliveryAddress
      ? completeBilingual(input.deliveryAddress, null)
      : { en: customer.address, hi: customer.addressHi ?? null };
    const buyer: InvoiceBuyer = {
      name: customer.name,
      nameHi: customer.nameHi ?? null,
      phone: customer.phones[0] ?? '',
      address: deliveryAddress.en,
      addressHi: deliveryAddress.hi,
      gstin: customer.gstin,
      stateCode: customer.stateCode,
    };
    // The bill before tax is the taxable value: bricks plus delivery, less discount.
    const tax = saleTax(seller, buyer, totals.totalPaise, org.gstRateBps);
    if (input.paymentAmount > tax.totalPaise) {
      throw new ValidationError('Payment too large', { paymentAmount: ['paymentTooLarge'] });
    }

    const sequence = await nextSequence(actor.orgId, 'sale', session);
    const invoice = invoiceSequence(org.invoicePrefix, date);
    const invoiceNumber = invoice.format(await nextSequence(actor.orgId, invoice.counter, session));

    const lines: SaleLine[] = [];
    for (const [index, line] of input.lines.entries()) {
      const product = byId.get(line.productId);
      await applyStockChange(
        {
          orgId: actor.orgId,
          productId: line.productId,
          qty: -line.qty,
          type: 'sale',
          refId: saleId.toString(),
          note: formatSaleNumber(sequence),
          occurredAt: date,
          actorId: actor.id,
        },
        session,
      );
      lines.push({
        productId: new Types.ObjectId(line.productId),
        productName: product?.name ?? '',
        productNameHi: product?.nameHi ?? null,
        qty: line.qty,
        ratePaise: line.rate,
        defaultRatePaise: product?.defaultRatePaise ?? line.rate,
        amountPaise: totals.lineAmounts[index] ?? 0,
      });
    }

    const paid = input.paymentAmount;
    await Sale.create(
      [
        {
          _id: saleId,
          orgId,
          number: sequence,
          invoiceNumber,
          seller,
          buyer,
          customerId: customer._id,
          customerName: customer.name,
          customerNameHi: customer.nameHi ?? null,
          customerPhone: customer.phones[0] ?? '',
          date,
          lines,
          bricks: totals.bricks,
          avgRatePaise: averageRate(totals.subtotalPaise, totals.bricks),
          subtotalPaise: totals.subtotalPaise,
          deliveryPaise: input.delivery,
          discountPaise: input.discount,
          taxablePaise: tax.taxablePaise,
          gstRateBps: tax.rateBps,
          cgstPaise: tax.cgstPaise,
          sgstPaise: tax.sgstPaise,
          igstPaise: tax.igstPaise,
          taxPaise: tax.taxPaise,
          totalPaise: tax.totalPaise,
          paidPaise: paid,
          duePaise: tax.totalPaise - paid,
          status: paymentStatus(tax.totalPaise, paid),
          payments:
            paid > 0
              ? [
                  {
                    amountPaise: paid,
                    mode: input.paymentMode,
                    paidAt: date,
                    note: null,
                    recordedBy: new Types.ObjectId(actor.id),
                    recordedByName: actor.name,
                    createdAt: now,
                  },
                ]
              : [],
          vehicleNo: input.vehicleNo,
          deliveryAddress: input.deliveryAddress,
          note: input.note,
          createdBy: new Types.ObjectId(actor.id),
          createdByName: actor.name,
        },
      ],
      { session },
    );

    await Customer.updateOne(
      { _id: customer._id, orgId },
      {
        $inc: {
          billedPaise: tax.totalPaise,
          paidPaise: paid,
          duePaise: tax.totalPaise - paid,
          bricksBought: totals.bricks,
          saleCount: 1,
        },
        $max: { lastSaleAt: date },
      },
      { session },
    );

    await recordAudit(
      {
        actor,
        action: 'sale.create',
        entity: 'Sale',
        entityId: saleId.toString(),
        changes: {
          number: sequence,
          invoiceNumber,
          customer: customer.name,
          bricks: totals.bricks,
          totalPaise: tax.totalPaise,
          paidPaise: paid,
        },
      },
      session,
    );

    await notify(
      {
        orgId: actor.orgId,
        type: 'sale_created',
        params: {
          number: formatSaleNumber(sequence),
          customer: customer.name,
          customerHi: customer.nameHi ?? customer.name,
          amountPaise: tax.totalPaise,
          bricks: totals.bricks,
        },
        href: `/sales/${saleId.toString()}`,
        excludeUserId: actor.id,
      },
      session,
    );

    return sequence;
  });

  return { id: saleId.toString(), number };
}

async function loadOpenSale(
  actor: SessionUser,
  saleId: string,
  session: ClientSession,
): Promise<SaleDoc> {
  const sale = await Sale.findOne({ _id: saleId, orgId: actor.orgId }).session(session).lean();
  if (!sale) throw new NotFoundError('Sale');
  if (sale.voidedAt) throw new ConflictError('ALREADY_VOIDED', 'Sale is voided');
  return sale;
}

export async function addPayment(
  actor: SessionUser,
  input: AddPaymentInput,
  timeZone: string,
): Promise<void> {
  assertCan(actor, 'sales:write');
  assertNotFuture(input.date, timeZone, 'date');

  await inTransaction(async (session) => {
    const sale = await loadOpenSale(actor, input.saleId, session);
    if (input.amount > sale.duePaise) {
      throw new ConflictError('OVERPAYMENT', 'Payment is more than the amount due');
    }

    const paid = sale.paidPaise + input.amount;
    // The due guard in the filter keeps two simultaneous payments from both
    // passing the check above and overpaying between them.
    const result = await Sale.updateOne(
      { _id: sale._id, orgId: sale.orgId, voidedAt: null, duePaise: { $gte: input.amount } },
      {
        $push: {
          payments: {
            amountPaise: input.amount,
            mode: input.mode,
            paidAt: startOfDay(input.date, timeZone),
            note: input.note,
            recordedBy: new Types.ObjectId(actor.id),
            recordedByName: actor.name,
            createdAt: new Date(),
          },
        },
        $inc: { paidPaise: input.amount, duePaise: -input.amount },
        $set: { status: paymentStatus(sale.totalPaise, paid) },
      },
      { session, runValidators: true },
    );
    if (result.modifiedCount === 0) {
      throw new ConflictError('OVERPAYMENT', 'Payment is more than the amount due');
    }

    await Customer.updateOne(
      { _id: sale.customerId, orgId: sale.orgId },
      { $inc: { paidPaise: input.amount, duePaise: -input.amount } },
      { session },
    );

    await recordAudit(
      {
        actor,
        action: 'sale.payment',
        entity: 'Sale',
        entityId: sale._id.toString(),
        changes: { number: sale.number, amountPaise: input.amount, mode: input.mode },
      },
      session,
    );

    await notify(
      {
        orgId: actor.orgId,
        type: 'payment_received',
        params: {
          number: formatSaleNumber(sale.number),
          customer: sale.customerName,
          customerHi: sale.customerNameHi ?? sale.customerName,
          amountPaise: input.amount,
        },
        href: `/sales/${sale._id.toString()}`,
        excludeUserId: actor.id,
      },
      session,
    );
  });
}

/**
 * Cancels a sale: the bricks go back into stock and the bill leaves the
 * customer's totals, payments included — any refund is settled outside the app.
 * The sale itself stays, marked void, so the history and the number remain.
 */
export async function voidSale(actor: SessionUser, input: VoidSaleInput): Promise<void> {
  assertCan(actor, 'sales:void');

  await inTransaction(async (session) => {
    const sale = await loadOpenSale(actor, input.saleId, session);

    const result = await Sale.updateOne(
      { _id: sale._id, orgId: sale.orgId, voidedAt: null },
      { $set: { voidedAt: new Date(), voidReason: input.reason } },
      { session },
    );
    if (result.modifiedCount === 0) throw new ConflictError('ALREADY_VOIDED', 'Sale is voided');

    for (const line of sale.lines) {
      await applyStockChange(
        {
          orgId: actor.orgId,
          productId: line.productId.toString(),
          qty: line.qty,
          type: 'sale_void',
          refId: sale._id.toString(),
          note: input.reason,
          occurredAt: new Date(),
          actorId: actor.id,
        },
        session,
      );
    }

    const latest = await Sale.findOne({
      orgId: sale.orgId,
      customerId: sale.customerId,
      voidedAt: null,
      _id: { $ne: sale._id },
    })
      .sort({ date: -1 })
      .select('date')
      .session(session)
      .lean();

    await Customer.updateOne(
      { _id: sale.customerId, orgId: sale.orgId },
      {
        $inc: {
          billedPaise: -sale.totalPaise,
          paidPaise: -sale.paidPaise,
          duePaise: -sale.duePaise,
          bricksBought: -sale.bricks,
          saleCount: -1,
        },
        $set: { lastSaleAt: latest?.date ?? null },
      },
      { session },
    );

    await recordAudit(
      {
        actor,
        action: 'sale.void',
        entity: 'Sale',
        entityId: sale._id.toString(),
        changes: { number: sale.number, reason: input.reason, totalPaise: sale.totalPaise },
      },
      session,
    );

    await notify(
      {
        orgId: actor.orgId,
        type: 'sale_voided',
        params: {
          number: formatSaleNumber(sale.number),
          customer: sale.customerName,
          customerHi: sale.customerNameHi ?? sale.customerName,
          amountPaise: sale.totalPaise,
          reason: input.reason,
        },
        href: `/sales/${sale._id.toString()}`,
        excludeUserId: actor.id,
      },
      session,
    );
  });
}
