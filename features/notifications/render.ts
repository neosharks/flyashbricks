import { formatMoney } from '@/lib/money';
import { formatQuantity } from '@/lib/quantity';
import { formatNumber } from '@/lib/utils';
import type { NotificationType } from '@/models/constants';
import type { NotificationParams } from '@/models/notification';

/** The slice of a next-intl translator rendering needs; works with both server and client ones. */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Turns stored raw values into display values for the reader's language:
 * paise become rupees, milli-units become quantities, unit keys become words.
 * Raw values are stored so one notification renders correctly in any language.
 */
export function displayParams(
  params: NotificationParams,
  locale: string,
  unitLabel: (unit: string) => string,
): Record<string, string | number> {
  const out: Record<string, string | number> = { ...params };
  // Names are stored in both scripts (`name`/`nameHi`, `customer`/`customerHi`);
  // a Hindi reader sees the Hindi one wherever it was recorded.
  if (locale === 'hi') {
    for (const key of ['name', 'customer'] as const) {
      const hindi = params[`${key}Hi`];
      if (typeof hindi === 'string' && hindi.trim() !== '') out[key] = hindi;
    }
  }
  if (typeof params.amountPaise === 'number') out.amount = formatMoney(params.amountPaise, locale);
  if (typeof params.qtyMilli === 'number') out.qty = formatQuantity(params.qtyMilli, locale);
  if (typeof params.unit === 'string') out.unit = unitLabel(params.unit);
  for (const key of ['count', 'bricks'] as const) {
    if (typeof params[key] === 'number') out[`${key}Text`] = formatNumber(params[key], locale);
  }
  return out;
}

export function renderNotification(
  t: Translate,
  type: NotificationType,
  params: Record<string, string | number>,
): { title: string; body: string } {
  return { title: t(`types.${type}.title`, params), body: t(`types.${type}.body`, params) };
}
