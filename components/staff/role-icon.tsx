import {
  Briefcase,
  Building2,
  ClipboardCheck,
  Cog,
  Forklift,
  Hammer,
  HardHat,
  Truck,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { StaffRole } from '@/models/constants';

export const ROLE_ICONS: Record<StaffRole, LucideIcon> = {
  labour: HardHat,
  moulder: Hammer,
  machine_operator: Cog,
  loader: Forklift,
  driver: Truck,
  supervisor: ClipboardCheck,
  manager: Briefcase,
  office: Building2,
  other: UserRound,
};
