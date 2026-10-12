import 'server-only';
import { ValidationError } from '@/lib/errors';
import { fail, type ActionResult } from '@/lib/result';
import { PhoneTakenError } from '@/features/customers/service';

/**
 * The services throw field-level failures as errors; forms need them as
 * values with the field each one belongs to. Anything else propagates to
 * `runAction`, which handles it generically.
 *
 * `phoneField` names the form field a taken phone number belongs to: a row of
 * the customer form (`phones.2`) or the sale form's single new-customer field.
 */
export async function withFieldErrors<T>(
  body: () => Promise<ActionResult<T>>,
  phoneField: (index: number | null) => string | null,
): Promise<ActionResult<T>> {
  try {
    return await body();
  } catch (err) {
    if (err instanceof ValidationError) {
      return fail(err.code, err.message, err.fields ? { fields: err.fields } : undefined);
    }
    if (err instanceof PhoneTakenError) {
      const field = phoneField(err.index);
      return fail(
        err.code,
        err.message,
        field ? { fields: { [field]: ['phoneTaken'] } } : undefined,
      );
    }
    throw err;
  }
}
