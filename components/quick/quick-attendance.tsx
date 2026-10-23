'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCheck } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FormErrors } from '@/components/ui/form-errors';
import { Input } from '@/components/ui/input';
import { STATUS_SELECTED } from '@/components/staff/status-chip';
import { useStaffErrors } from '@/components/staff/use-staff-errors';
import { markAttendanceAction } from '@/features/staff/actions';
import { AttendanceSheetSchema, foldSheet } from '@/features/staff/schema';
import type { SheetRow } from '@/features/staff/types';
import { useActionForm } from '@/hooks/use-action-form';
import { pickText } from '@/lib/bilingual';
import { cn } from '@/lib/utils';
import type { AttendanceStatus } from '@/models/constants';
import { DoneScreen } from './done-screen';
import { TaskFrame } from './task-frame';

/** The everyday three; leave and holidays are marked on the full sheet. */
const CHOICES = ['present', 'half_day', 'absent'] as const satisfies AttendanceStatus[];

type Mark = { status: AttendanceStatus | null; bricks: string };

/**
 * Today's attendance as one list: "everyone present" for the usual day, then
 * a tap on whoever is not. Overtime already entered on the full sheet is kept.
 */
export function QuickAttendance({ rows, today }: { rows: SheetRow[]; today: string }) {
  const t = useTranslations('quick');
  const ts = useTranslations('staff');
  const locale = useLocale();
  const translateError = useStaffErrors();
  const [marks, setMarks] = useState<Record<string, Mark>>(() =>
    Object.fromEntries(
      rows.map((row) => [
        row.id,
        { status: row.status, bricks: row.bricks ? String(row.bricks) : '' },
      ]),
    ),
  );
  const [saved, setSaved] = useState<number | null>(null);

  const form = useActionForm(markAttendanceAction, (result) => setSaved(result.marked), {
    schema: AttendanceSheetSchema,
    prepare: foldSheet,
    translate: translateError,
  });

  const set = (id: string, change: Partial<Mark>) =>
    setMarks((current) => ({
      ...current,
      [id]: { status: null, bricks: '', ...current[id], ...change },
    }));
  const unmarked = rows.filter((row) => !marks[row.id]?.status).length;
  const present = rows.filter((row) => marks[row.id]?.status === 'present').length;
  const title = t('tasks.attendance.title');

  if (saved !== null) {
    return (
      <DoneScreen
        title={t('attendance.done')}
        detail={t('attendance.doneDetail', { count: saved, present })}
        again={t('attendance.again')}
        onAgain={() => setSaved(null)}
        home={t('backHome')}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <TaskFrame title={title} step={0} steps={1} question={t('attendance.nobody')}>
        <p className="text-foreground-muted">{t('askAdmin')}</p>
      </TaskFrame>
    );
  }

  return (
    <form method="post" onSubmit={form.onSubmit} noValidate>
      <input type="hidden" name="date" value={today} />
      {rows.map((row) => {
        const mark = marks[row.id];
        if (!mark?.status) return null;
        const minutes = row.overtimeMinutes;
        return (
          <span key={row.id} hidden>
            <input type="hidden" name={`att.${row.id}.status`} value={mark.status} />
            <input
              type="hidden"
              name={`att.${row.id}.ot`}
              value={minutes ? String(minutes / 60) : ''}
            />
            <input type="hidden" name={`att.${row.id}.bricks`} value={mark.bricks} />
          </span>
        );
      })}

      <TaskFrame
        title={title}
        step={0}
        steps={1}
        question={t('attendance.who')}
        footer={
          <Button
            type="submit"
            size="lg"
            full
            loading={form.pending}
            disabled={unmarked === rows.length}
          >
            {form.pending
              ? t('saving')
              : unmarked > 0
                ? t('attendance.saveSome', { count: rows.length - unmarked, left: unmarked })
                : t('attendance.save', { count: rows.length })}
          </Button>
        }
      >
        <FormErrors form={form} />
        {unmarked > 0 && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => {
              for (const row of rows)
                if (!marks[row.id]?.status) set(row.id, { status: 'present' });
            }}
          >
            <CheckCheck aria-hidden />
            {t('attendance.allPresent', { count: unmarked })}
          </Button>
        )}

        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const mark = marks[row.id] ?? { status: null, bricks: '' };
            const name = pickText(row.name, row.nameHi, locale);
            const working = mark.status === 'present' || mark.status === 'half_day';
            return (
              <li
                key={row.id}
                className={cn(
                  'bg-surface rounded-xl border p-3',
                  mark.status ? 'border-border' : 'border-warning/60 border-dashed',
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
                    <p className="truncate text-lg font-semibold">{name}</p>
                    <p className="text-foreground-muted text-sm">
                      {ts(`roles.${row.role}`)}
                      {mark.status && !CHOICES.some((choice) => choice === mark.status)
                        ? ` · ${ts(`status.${mark.status}`)}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label={name}>
                  {CHOICES.map((status) => {
                    const selected = mark.status === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => set(row.id, { status: selected ? null : status })}
                        className={cn(
                          'min-h-14 rounded-xl border text-base font-semibold',
                          selected
                            ? STATUS_SELECTED[status]
                            : 'border-border-strong bg-surface hover:bg-surface-muted',
                        )}
                      >
                        {ts(`status.${status}`)}
                      </button>
                    );
                  })}
                </div>
                {working && row.wageType === 'per_thousand_bricks' && (
                  <label className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-foreground-muted text-sm">{t('attendance.bricks')}</span>
                    <Input
                      value={mark.bricks}
                      inputMode="numeric"
                      autoComplete="off"
                      onChange={(event) => set(row.id, { bricks: event.target.value })}
                      className="w-32 text-right text-lg"
                    />
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      </TaskFrame>
    </form>
  );
}
