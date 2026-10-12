/** Where an audited record lives in the app, so the log can link to it. */
export function activityHref(entity: string, entityId: string): string | null {
  switch (entity) {
    case 'User':
      return `/users/${entityId}`;
    case 'RawMaterial':
      return `/raw-materials/${entityId}`;
    case 'Sale':
      return `/sales/${entityId}`;
    case 'Customer':
      return `/customers/${entityId}`;
    case 'Product':
      return '/stock';
    case 'ProductionEntry':
      return '/production';
    case 'Organization':
      return '/settings';
    case 'Backup':
      return '/backup';
    case 'StaffMember':
      // A whole day's sheet or a wages export has no single person to open.
      if (entityId === 'sheet') return '/staff/attendance';
      if (entityId === 'export') return '/staff/payroll';
      return `/staff/${entityId}`;
    default:
      return null;
  }
}

export const ACTIVITY_ENTITIES = [
  'User',
  'RawMaterial',
  'ProductionEntry',
  'Product',
  'Sale',
  'Customer',
  'Organization',
  'Backup',
  'StaffMember',
] as const;
export type ActivityEntity = (typeof ACTIVITY_ENTITIES)[number];
