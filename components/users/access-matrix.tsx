'use client';

import { useTranslations } from 'next-intl';
import { ACCESS_LEVELS, MODULES, type AccessLevel, type Permissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';

/**
 * One row per section, each a three-way segmented choice (no access / view /
 * view & edit). Real radio inputs, so it is keyboard and screen-reader
 * operable, and it posts as `perm_<module>`.
 */
export function AccessMatrix({
  value,
  onChange,
  disabled,
  /** Levels above this are not offered: an employee cannot grant more than they hold. */
  ceiling,
}: {
  value: Permissions;
  onChange: (next: Permissions) => void;
  disabled?: boolean;
  ceiling?: Permissions | null;
}) {
  const t = useTranslations('users');
  const rank: Record<AccessLevel, number> = { none: 0, read: 1, write: 2 };

  return (
    <div className="border-border divide-border divide-y rounded-lg border">
      {MODULES.map((module) => (
        <fieldset
          key={module}
          className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <legend className="sr-only">{t(`modules.${module}`)}</legend>
          <div aria-hidden className="min-w-0">
            <p className="text-sm font-medium">{t(`modules.${module}`)}</p>
            <p className="text-foreground-muted text-xs">{t(`moduleHints.${module}`)}</p>
          </div>
          <div className="bg-surface-muted flex shrink-0 rounded-md p-0.5 sm:inline-flex">
            {ACCESS_LEVELS.map((level) => {
              const blocked = ceiling ? rank[level] > rank[ceiling[module]] : false;
              const checked = value[module] === level;
              return (
                <label
                  key={level}
                  className={cn(
                    'flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded px-3 text-center text-xs font-medium transition-colors sm:min-h-9 sm:flex-none',
                    checked
                      ? level === 'none'
                        ? 'bg-surface text-foreground shadow-xs'
                        : 'bg-action text-action-foreground shadow-xs'
                      : 'text-foreground-muted hover:text-foreground',
                    ((disabled ?? false) || blocked) && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <input
                    type="radio"
                    name={`perm_${module}`}
                    value={level}
                    checked={checked}
                    disabled={disabled === true || blocked}
                    onChange={() => onChange({ ...value, [module]: level })}
                    className="sr-only"
                  />
                  {t(`levels.${level}`)}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/** Compact read-only summary for the list. */
export function AccessSummary({
  permissions,
  admin,
}: {
  permissions: Permissions;
  admin: boolean;
}) {
  const t = useTranslations('users');
  if (admin) {
    return <span className="text-foreground-muted text-xs">{t('fullAccess')}</span>;
  }
  const granted = MODULES.filter((module) => permissions[module] !== 'none');
  if (granted.length === 0) return <span className="text-foreground-subtle text-xs">—</span>;
  return (
    <ul className="flex flex-wrap gap-1">
      {granted.map((module) => (
        <li
          key={module}
          className={cn(
            'rounded px-1.5 py-0.5 text-xs whitespace-nowrap',
            permissions[module] === 'write'
              ? 'bg-action-subtle text-action'
              : 'bg-surface-muted text-foreground-muted',
          )}
        >
          {t(`modules.${module}`)} · {t(`levelsShort.${permissions[module]}`)}
        </li>
      ))}
    </ul>
  );
}
