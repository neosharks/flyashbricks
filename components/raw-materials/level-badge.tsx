import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Level } from '@/components/ui/meter';

const TONE = { good: 'success', warning: 'warning', critical: 'danger' } as const;
const ICON = { good: CheckCircle2, warning: AlertTriangle, critical: AlertOctagon } as const;

/** A stock level in words, colour and icon — never colour alone. */
export function LevelBadge({ level, label }: { level: Level; label: string }) {
  const Icon = ICON[level];
  return (
    <Badge tone={TONE[level]}>
      <Icon aria-hidden className="size-3.5" />
      {label}
    </Badge>
  );
}
