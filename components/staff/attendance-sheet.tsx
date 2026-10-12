'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CheckCheck, Save } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { markAttendanceAction } from '@/features/staff/actions';
import type { SheetRow } from '@/features/staff/types';
import { useActionForm } from '@/hooks/use-action-form';
import { pickText } from '@/lib/bilingual';
import { cn } from '@/lib/utils';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '@/models/constants';
import { STATUS_SELECTED } from './status-chip';
import { useStaffErrors } from './use-staff-errors';

type Mark = {
  status: AttendanceStatus | null;
  overtime: string;
  bricks: string;
  showOvertime: boolean;
};

function hoursText(minutes: number): string {
  if (minutes === 0) return '';
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, '');
}

/**
 * The daily sheet, built for one hand on a phone: one card per person with
 * five big buttons, "mark everyone present" for the usual day, and a save bar
 * that stays in reach. People not marked yet are outlined so nobody is missed.
 */
export function AttendanceSheet({
  rows,
  date,
  today,
  canWrite,
}: {
  rows: SheetRow[];
  date: string;
  today: string;
  canWrite: boolean;
}) {
  const t = useTranslations('staff');
  const locale = useLocale();
  const router = useRouter();
  const translateError = useStaffErrors();

  const initial = useMemo(
    () =>
      Object.fromEntries(
        rows.map((row) => [
          row.id,
          {
            status: row.status,
            overtime: hoursText(row.overtimeMinutes),
            bricks: row.bricks ? String(row.bricks) : '',
            showOvertime: row.overtimeMinutes > 0,
          } satisfies Mark,
        ]),
      ),
    [rows],
  );
  const [marks, setMarks] = useState<Record<string, Mark>>(initial);

  const form = useActionForm(markAttendanceAction, (result) => {
    toast.success(t('sheet.saved', { count: result.marked }));
    router.refresh();
  });

  const update = (id: string, change: Partial<Mark>) =>
    setMarks((current) => {
      const existing = current[id] ?? {
        status: null,
        overtime: '',
        bricks: '',
        showOvertime: false,
      };
      return { ...current, [id]: { ...existing, ...change } };
    });

  const counts = ATTENDANCE_STATUSES.reduce<Record<string, number>>((acc, status) => {
    acc[status] = rows.filter((row) => marks[row.id]?.status === status).length;
    return acc;
  }, {});
  const unmarked = rows.filter((row) => !marks[row.id]?.status).length;

  if (rows.length === 0) {
    return <p className="text-foreground-muted text-sm">{t('sheet.nobody')}</p>;
  }

  return (
    <form method="post" onSubmit={form.onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="date" value={date} />
      {form.formError && (
        <Alert tone="danger">{translateError(form.error('entries')) ?? form.formError}</Alert>
      )}
      {!canWrite && <Alert tone="info">{t('sheet.readOnly')}</Alert>}

      <div className="border-border bg-surface flex flex-wrap items-center gap-2 rounded-lg border p-3">
        {ATTENDANCE_STATUSES.map((status) => (
          <span key={status} className="text-sm">
            <span className="font-semibold tabular-nums">{counts[status]}</span>{' '}
            <span className="text-foreground-muted">{t(`status.${status}`)}</span>
          </span>
        ))}
        <span
          className={cn(
            'ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium',
            unmarked > 0 ? 'bg-warning-subtle text-warning' : 'bg-success-subtle text-success',
          )}
        >
          {unmarked > 0 ? t('sheet.unmarked', { count: unmarked }) : t('sheet.allMarked')}
        </span>
      </div>

      {canWrite && unmarked > 0 && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() =>
            setMarks((current) => {
              const next = { ...current };
              for (const row of rows) {
                const mark = next[row.id];
                if (row.isActive && !mark?.status) {
                  next[row.id] = {
                    overtime: '',
                    bricks: '',
                    showOvertime: false,
                    ...mark,
                    status: 'present',
                  };
                }
              }
              return next;
            })
          }
        >
          <CheckCheck aria-hidden />
          {t('sheet.markAll')}
        </Button>
      )}

      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const mark = marks[row.id] ?? {
            status: null,
            overtime: '',
            bricks: '',
            showOvertime: false,
          };
          const name = pickText(row.name, row.nameHi, locale);
          return (
            <li
              key={row.id}
              className={cn(
                'bg-surface rounded-lg border p-3',
                mark.status ? 'border-border' : 'border-warning/50 border-dashed',
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar
                  name={row.name}
                  imageId={row.photoAssetId}
                  gender={row.gender}
                  variant={row.avatarVariant}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{name}</p>
                  <p className="text-foreground-muted text-xs">
                    {t(`roles.${row.role}`)}
                    {!row.isActive && ` · ${t('sheet.notWorkingAnyMore')}`}
                  </p>
                </div>
              </div>

              <fieldset className="mt-3" disabled={!canWrite}>
                <legend className="sr-only">{name}</legend>
                <div className="grid grid-cols-5 gap-1.5">
                  {ATTENDANCE_STATUSES.map((status) => {
                    const selected = mark.status === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        aria-pressed={selected}
                        title={t(`status.${status}`)}
                        onClick={() => update(row.id, { status: selected ? null : status })}
                        className={cn(
                          'flex min-h-12 flex-col items-center justify-center rounded-md border px-1 text-sm font-semibold transition-colors disabled:opacity-50',
                          selected
                            ? STATUS_SELECTED[status]
                            : 'border-border-strong bg-surface hover:bg-surface-muted',
                        )}
                      >
                        <span aria-hidden className="sm:hidden">
                          {t(`statusShort.${status}`)}
                        </span>
                        <span className="hidden text-xs sm:inline">{t(`status.${status}`)}</span>
                        <span className="sr-only sm:hidden">{t(`status.${status}`)}</span>
                      </button>
                    );
                  })}
                </div>
                {mark.status && (
                  <p className="text-foreground-muted mt-1 text-xs sm:hidden">
                    {t(`status.${mark.status}`)}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-end gap-3">
                  {row.wageType === 'per_thousand_bricks' && (
                    <label className="flex flex-col gap-1 text-xs">
                      {t('sheet.bricks')}
                      <Input
                        value={mark.bricks}
                        inputMode="numeric"
                        onChange={(event) => update(row.id, { bricks: event.target.value })}
                        className="w-32"
                      />
                    </label>
                  )}
                  {mark.showOvertime ? (
                    <label className="flex flex-col gap-1 text-xs">
                      {t('sheet.overtimeHours')}
                      <Input
                        value={mark.overtime}
                        inputMode="decimal"
                        onChange={(event) => update(row.id, { overtime: event.target.value })}
                        className="w-28"
                      />
                    </label>
                  ) : (
                    canWrite && (
                      <button
                        type="button"
                        onClick={() => update(row.id, { showOvertime: true })}
                        className="text-action min-h-11 text-sm font-medium"
                      >
                        {t('sheet.addOvertime')}
                      </button>
                    )
                  )}
                </div>
              </fieldset>

              {mark.status && (
                <>
                  <input type="hidden" name={`att.${row.id}.status`} value={mark.status} />
                  <input type="hidden" name={`att.${row.id}.ot`} value={mark.overtime} />
                  <input type="hidden" name={`att.${row.id}.bricks`} value={mark.bricks} />
                </>
              )}
            </li>
          );
        })}
      </ul>

      {canWrite && (
        <div className="border-border bg-surface/95 sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-4 border-t px-4 py-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:rounded-lg lg:border">
          <Button
            type="submit"
            size="lg"
            loading={form.pending}
            disabled={date > today}
            className="w-full"
          >
            {!form.pending && <Save aria-hidden />}
            {form.pending ? t('sheet.saving') : t('sheet.save')}
          </Button>
        </div>
      )}
    </form>
  );
}
