import 'server-only';
import { Types, type ClientSession } from '@/lib/mongoose';
import { AVATAR_VARIANTS } from '@/models/constants';
import { User } from '@/models/user';
import { StaffMember } from '@/models/staff-member';

/**
 * The cartoon a new person starts with, handed out in rotation across the
 * organisation's app logins and staff together — the 1st person gets design
 * 0, the 2nd design 1, and so on, wrapping after 100 — so people added one
 * after another never look alike.
 */
export async function nextAvatarVariant(orgId: string, session?: ClientSession): Promise<number> {
  const org = new Types.ObjectId(orgId);
  const [users, staff] = await Promise.all([
    User.countDocuments({ orgId: org }).session(session ?? null),
    StaffMember.countDocuments({ orgId: org }).session(session ?? null),
  ]);
  return (users + staff) % AVATAR_VARIANTS;
}
