import 'server-only';
import { Types, type ClientSession, type ObjectId } from '@/lib/mongoose';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { recordAudit } from '@/lib/audit';
import { searchTerms } from '@/lib/utils';
import type { SessionUser } from '@/lib/permissions';
import { Customer, type CustomerDoc } from '@/models/customer';
import { Sale } from '@/models/sale';
import type { CreateCustomerInput, UpdateCustomerInput } from './schema';

/** A phone number already belongs to another customer; `index` is the form row. */
export class PhoneTakenError extends ConflictError {
  constructor(readonly index: number | null) {
    super('DUPLICATE_PHONE', 'A customer with this phone number already exists');
  }
}

export function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === 11000;
}

/**
 * Checked up front so the form can point at the exact row. The unique index is
 * still the real guarantee: two people saving at once both pass this check,
 * and the second insert fails on the index instead.
 */
async function assertPhonesFree(
  orgId: ObjectId,
  phones: string[],
  excludeId: ObjectId | null,
  session?: ClientSession,
): Promise<void> {
  const clash = await Customer.findOne({
    orgId,
    phones: { $in: phones },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select('phones')
    .session(session ?? null)
    .lean();
  if (clash) {
    const index = phones.findIndex((phone) => clash.phones.includes(phone));
    throw new PhoneTakenError(index >= 0 ? index : null);
  }
}

export async function createCustomer(
  actor: SessionUser,
  input: CreateCustomerInput,
  session?: ClientSession,
): Promise<CustomerDoc> {
  const orgId = new Types.ObjectId(actor.orgId);
  await assertPhonesFree(orgId, input.phones, null, session);

  try {
    const [created] = await Customer.create(
      [
        {
          ...input,
          orgId,
          searchTerms: searchTerms(
            input.name,
            input.nameHi,
            input.city,
            input.cityHi,
            ...input.phones,
          ),
          createdBy: new Types.ObjectId(actor.id),
        },
      ],
      session ? { session } : {},
    );
    if (!created) throw new Error('Customer was not created');

    await recordAudit(
      {
        actor,
        action: 'customer.create',
        entity: 'Customer',
        entityId: created._id.toString(),
        changes: { name: input.name },
      },
      session,
    );
    return created.toObject();
  } catch (err) {
    if (isDuplicateKey(err)) throw new PhoneTakenError(null);
    throw err;
  }
}

/**
 * Renames carry through to the sales' copied name and phone, so a search on
 * the sales list finds the customer by the name they have now.
 */
export async function updateCustomer(
  actor: SessionUser,
  input: UpdateCustomerInput,
  session: ClientSession,
): Promise<void> {
  const orgId = new Types.ObjectId(actor.orgId);
  const id = new Types.ObjectId(input.id);
  const existing = await Customer.findOne({ _id: id, orgId }).session(session).lean();
  if (!existing) throw new NotFoundError('Customer');

  await assertPhonesFree(orgId, input.phones, id, session);

  const { id: _id, ...changes } = input;
  try {
    await Customer.updateOne(
      { _id: id, orgId },
      {
        $set: {
          ...changes,
          searchTerms: searchTerms(
            input.name,
            input.nameHi,
            input.city,
            input.cityHi,
            ...input.phones,
          ),
        },
      },
      { session, runValidators: true },
    );
  } catch (err) {
    if (isDuplicateKey(err)) throw new PhoneTakenError(null);
    throw err;
  }

  const primary = input.phones[0] ?? existing.phones[0] ?? '';
  if (
    existing.name !== input.name ||
    existing.nameHi !== input.nameHi ||
    existing.phones[0] !== primary
  ) {
    await Sale.updateMany(
      { orgId, customerId: id },
      { $set: { customerName: input.name, customerNameHi: input.nameHi, customerPhone: primary } },
      { session },
    );
  }

  await recordAudit(
    {
      actor,
      action: 'customer.update',
      entity: 'Customer',
      entityId: input.id,
      changes: {
        ...(existing.name !== input.name ? { name: { from: existing.name, to: input.name } } : {}),
        phones: input.phones.length,
      },
    },
    session,
  );
}
