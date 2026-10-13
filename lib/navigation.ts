import { can, type Action, type SessionUser } from './permissions';

export type NavIcon =
  | 'dashboard'
  | 'rawMaterials'
  | 'production'
  | 'stock'
  | 'sales'
  | 'customers'
  | 'users'
  | 'activity'
  | 'settings'
  | 'notifications'
  | 'staff'
  | 'attendance';

export type NavItem = {
  href: string;
  /** Key under `nav` in the messages. */
  label: NavIcon;
  icon: NavIcon;
  group: 'main' | 'manufacturing' | 'selling' | 'people' | 'admin';
};

const ALL: (NavItem & { requires: Action | null })[] = [
  { href: '/', label: 'dashboard', icon: 'dashboard', group: 'main', requires: null },
  {
    href: '/notifications',
    label: 'notifications',
    icon: 'notifications',
    group: 'main',
    requires: null,
  },
  {
    href: '/raw-materials',
    label: 'rawMaterials',
    icon: 'rawMaterials',
    group: 'manufacturing',
    requires: 'rawMaterials:read',
  },
  {
    href: '/production',
    label: 'production',
    icon: 'production',
    group: 'manufacturing',
    requires: 'production:read',
  },
  {
    href: '/stock',
    label: 'stock',
    icon: 'stock',
    group: 'manufacturing',
    requires: 'production:read',
  },
  { href: '/sales', label: 'sales', icon: 'sales', group: 'selling', requires: 'sales:read' },
  {
    href: '/customers',
    label: 'customers',
    icon: 'customers',
    group: 'selling',
    requires: 'sales:read',
  },
  {
    href: '/staff/attendance',
    label: 'attendance',
    icon: 'attendance',
    group: 'people',
    requires: 'staff:read',
  },
  { href: '/staff', label: 'staff', icon: 'staff', group: 'people', requires: 'staff:read' },
  { href: '/users', label: 'users', icon: 'users', group: 'admin', requires: 'users:read' },
  {
    href: '/activity',
    label: 'activity',
    icon: 'activity',
    group: 'admin',
    requires: 'activity:read',
  },
  {
    href: '/settings',
    label: 'settings',
    icon: 'settings',
    group: 'admin',
    requires: 'settings:manage',
  },
];

/** The sections this person may open. Hiding a link is UX; each page re-checks. */
export function navItemsFor(user: SessionUser): NavItem[] {
  return ALL.filter((item) => item.requires === null || can(user, item.requires)).map(
    ({ requires: _requires, ...item }) => item,
  );
}
