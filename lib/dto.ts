import type { ObjectId } from '@/lib/mongoose';

/**
 * ObjectId and Date are not serialisable across the Server→Client boundary.
 * Every document is mapped through a feature-level `toDTO` before it is handed
 * to a Client Component; these are the primitives those mappers use.
 */
export function idToString(value: ObjectId | string): string {
  return typeof value === 'string' ? value : value.toString();
}

export function dateToIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function optionalIdToString(value: ObjectId | string | null | undefined): string | null {
  return value == null ? null : idToString(value);
}
