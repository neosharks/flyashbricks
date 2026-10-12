import 'server-only';
import { cache } from 'react';
import { connectDb } from '@/lib/db';
import { DEFAULT_TIMEZONE } from '@/lib/dates';
import type { StateCode } from '@/lib/gst';
import { Organization } from '@/models/organization';

export type OrgSummary = {
  timezone: string;
  stateCode: StateCode | null;
  /** GST applies only when the yard is registered. */
  gstRateBps: number;
  registered: boolean;
};

/** The few organisation facts most screens need; deduped per request. */
export const getOrgSummary = cache(async (orgId: string): Promise<OrgSummary> => {
  await connectDb();
  const org = await Organization.findById(orgId)
    .select('timezone stateCode gstin gstRateBps')
    .lean();
  return {
    timezone: org?.timezone ?? DEFAULT_TIMEZONE,
    stateCode: org?.stateCode ?? null,
    gstRateBps: org?.gstin ? org.gstRateBps : 0,
    registered: Boolean(org?.gstin),
  };
});

/** The yard's timezone decides where "today" and every date filter begin. */
export async function getOrgTimezone(orgId: string): Promise<string> {
  return (await getOrgSummary(orgId)).timezone;
}
