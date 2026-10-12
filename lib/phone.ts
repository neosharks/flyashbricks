/**
 * Phone numbers are Indian only and stored as their ten significant digits,
 * so "+91 98765-43210", "098765 43210" and "9876543210" are the same person —
 * they are a customer's identity and a login, so a formatting difference must
 * never create a second record. Landlines with an STD code ("0141 2345678")
 * reduce to ten digits the same way.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return INDIAN_PHONE.test(digits) ? digits : null;
}

/** Ten digits, never starting with 0 (that is the trunk prefix, not part of the number). */
export const INDIAN_PHONE = /^[1-9]\d{9}$/;

export function formatPhone(digits: string): string {
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}
