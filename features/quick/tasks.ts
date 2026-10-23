import { can, type Action, type SessionUser } from '@/lib/permissions';

/**
 * Simple mode: the everyday entries, one big button each, for people who come
 * to the app to record one thing and leave. Each opens a step-by-step screen
 * under /quick that posts to the same Server Action as the full form.
 */
export const QUICK_TASKS = ['production', 'sale', 'payment', 'attendance', 'purchase'] as const;
export type QuickTask = (typeof QUICK_TASKS)[number];

const REQUIRES: Record<QuickTask, Action> = {
  production: 'production:write',
  sale: 'sales:write',
  payment: 'sales:write',
  attendance: 'staff:write',
  purchase: 'rawMaterials:write',
};

export function quickTasksFor(user: SessionUser): QuickTask[] {
  return QUICK_TASKS.filter((task) => can(user, REQUIRES[task]));
}

export function canDoTask(user: SessionUser, task: QuickTask): boolean {
  return can(user, REQUIRES[task]);
}

export const HOME_MODES = ['simple', 'full'] as const;
export type HomeMode = (typeof HOME_MODES)[number];

/**
 * Whether `/` sends this person to simple mode. A choice saved on the device
 * wins; otherwise an employee who records things starts there and an admin
 * starts on the dashboard. Nobody is sent there with nothing to do.
 */
export function opensInSimpleMode(user: SessionUser, saved: string | undefined): boolean {
  if (quickTasksFor(user).length === 0) return false;
  if (saved === 'simple') return true;
  if (saved === 'full') return false;
  return user.role === 'employee';
}
