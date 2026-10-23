import { describe, expect, it } from 'vitest';
import { NO_ACCESS, type SessionUser } from '@/lib/permissions';
import { opensInSimpleMode, quickTasksFor } from './tasks';

const person = (overrides: Partial<SessionUser> = {}): SessionUser => ({
  id: 'u1',
  orgId: 'o1',
  name: 'Pooja Saini',
  role: 'employee',
  permissions: NO_ACCESS,
  mustChangePassword: false,
  ...overrides,
});

describe('quick tasks', () => {
  it('offers only what the person may write', () => {
    expect(
      quickTasksFor(person({ permissions: { ...NO_ACCESS, sales: 'write', production: 'read' } })),
    ).toEqual(['sale', 'payment']);
    expect(quickTasksFor(person({ permissions: { ...NO_ACCESS, production: 'write' } }))).toEqual([
      'production',
    ]);
    expect(quickTasksFor(person({ role: 'admin' }))).toHaveLength(5);
  });

  it('opens an employee who records things in simple mode, unless they chose the full app', () => {
    const clerk = person({ permissions: { ...NO_ACCESS, sales: 'write' } });
    expect(opensInSimpleMode(clerk, undefined)).toBe(true);
    expect(opensInSimpleMode(clerk, 'full')).toBe(false);
  });

  it('opens an admin on the dashboard unless they chose simple mode', () => {
    const owner = person({ role: 'admin' });
    expect(opensInSimpleMode(owner, undefined)).toBe(false);
    expect(opensInSimpleMode(owner, 'simple')).toBe(true);
  });

  it('never sends someone with nothing to enter to simple mode', () => {
    const viewer = person({
      permissions: {
        rawMaterials: 'read',
        production: 'read',
        sales: 'read',
        staff: 'read',
        users: 'read',
      },
    });
    expect(opensInSimpleMode(viewer, undefined)).toBe(false);
    expect(opensInSimpleMode(viewer, 'simple')).toBe(false);
  });
});
