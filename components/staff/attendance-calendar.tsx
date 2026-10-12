'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { markAttendanceAction } from '@/features/staff/actions';
import type { DayMark } from '@/features/staff/types';
import { useActionForm } from '@/hooks/use-action-form';
import { intlLocale } from '@/lib/money';
import { cn } from '@/lib/utils';
import { ATTENDANCE_STATUSES, type AttendanceStatus, type WageType } from '@/models/constants';
import { STATUS_SELECTED, STATUS_TONES } from './status-chip';
import { useStaffErrors } from './use-staff-errors';

/**
 * A month of one person's attendance as a calendar. Each marked day shows its
 * short status; tapping a day (up to today) opens a small editor.
 */
export function AttendanceCalendar({
  staffId,
  month,
  marks,
  today,
  wageType,
  canWrite,
}: {
  staffId: string;
  month: string;
  marks: DayMark[];
  today: string;
  wageType: WageType;
  canWrite: boolean;
}) {
  const t = useTranslations('staff');
  const locale = useLocale();
  const router = useRouter();
  const translateError = useStaffErrors();
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<AttendanceStatus | 'none'>('present');
  const [overtime, setOvertime] = useState('');
  const [bricks, setBricks] = useState('');

  const form = useActionForm(markAttendanceAction, () => {
    toast.success(t('payment.saved'));
    setEditing(null);
    router.refresh();
  });

  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year ?? 1970, (monthNumber ?? 1) - 1, 1));
  const days = new Date(Date.UTC(year ?? 1970, monthNumber ?? 1, 0)).getUTCDate();
  // Weeks start on Monday, as on Indian calendars.
  const offset = (first.getUTCDay() + 6) % 7;
  const byDay = new Map(marks.map((mark) => [mark.day, mark]));
  const weekday = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'narrow',
    timeZone: 'UTC',
  });
  const headers = Array.from({ length: 7 }, (_, index) =>
    weekday.format(new Date(Date.UTC(2024, 0, 1 + index))),
  );
  const longDate = new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: 'full',
    timeZone: 'UTC',
  });

  function open(day: string): void {
    const mark = byDay.get(day);
    setStatus(mark?.status ?? 'present');
    setOvertime(mark?.overtimeMinutes ? String(mark.overtimeMinutes / 60) : '');
    setBricks(mark?.bricks ? String(mark.bricks) : '');
    setEditing(day);
  }

  return (
    <>
      <div className="grid grid-cols-7 gap-1 text-center">
        {headers.map((label, index) => (
          <span key={index} className="text-foreground-subtle py-1 text-xs font-medium">
            {label}
          </span>
        ))}
        {Array.from({ length: offset }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}
        {Array.from({ length: days }, (_, index) => {
          const day = `${month}-${String(index + 1).padStart(2, '0')}`;
          const mark = byDay.get(day);
          const future = day > today;
          const label = `${longDate.format(new Date(`${day}T00:00:00Z`))}: ${t(`status.${mark?.status ?? 'none'}`)}`;
          return (
            <button
              key={day}
              type="button"
              disabled={future || !canWrite}
              onClick={() => open(day)}
              aria-label={label}
              className={cn(
                'flex aspect-square min-h-10 flex-col items-center justify-center rounded-md border text-xs disabled:cursor-default',
                mark ? STATUS_TONES[mark.status] : 'border-border bg-surface',
                future && 'opacity-40',
                day === today && 'ring-action ring-2',
              )}
            >
              <span className="tabular-nums">{index + 1}</span>
              {mark && <span className="font-semibold">{t(`statusShort.${mark.status}`)}</span>}
            </button>
          );
        })}
      </div>

      <Dialog open={editing !== null} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent
          title={
            editing
              ? t('day.title', { date: longDate.format(new Date(`${editing}T00:00:00Z`)) })
              : ''
          }
          description={t('day.description')}
        >
          <form method="post" onSubmit={form.onSubmit} className="flex flex-col gap-4" noValidate>
            {form.formError && (
              <Alert tone="danger">{translateError(form.error('date')) ?? form.formError}</Alert>
            )}
            <input type="hidden" name="date" value={editing ?? ''} />
            <input type="hidden" name={`att.${staffId}.status`} value={status} />
            <input
              type="hidden"
              name={`att.${staffId}.ot`}
              value={status === 'none' ? '' : overtime}
            />
            <input
              type="hidden"
              name={`att.${staffId}.bricks`}
              value={status === 'none' ? '' : bricks}
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ATTENDANCE_STATUSES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={status === option}
                  onClick={() => setStatus(option)}
                  className={cn(
                    'min-h-12 rounded-md border text-sm font-medium',
                    status === option
                      ? STATUS_SELECTED[option]
                      : 'border-border-strong hover:bg-surface-muted',
                  )}
                >
                  {t(`status.${option}`)}
                </button>
              ))}
              {editing && byDay.has(editing) && (
                <button
                  type="button"
                  aria-pressed={status === 'none'}
                  onClick={() => setStatus('none')}
                  className={cn(
                    'min-h-12 rounded-md border border-dashed text-sm',
                    status === 'none'
                      ? 'border-foreground bg-surface-muted'
                      : 'border-border-strong',
                  )}
                >
                  {t('sheet.clear')}
                </button>
              )}
            </div>

            {status !== 'none' && (
              <div className="flex flex-wrap gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  {t('sheet.overtimeHours')}
                  <Input
                    value={overtime}
                    inputMode="decimal"
                    onChange={(event) => setOvertime(event.target.value)}
                    className="w-32"
                  />
                </label>
                {wageType === 'per_thousand_bricks' && (
                  <label className="flex flex-col gap-1 text-sm">
                    {t('sheet.bricks')}
                    <Input
                      value={bricks}
                      inputMode="numeric"
                      onChange={(event) => setBricks(event.target.value)}
                      className="w-32"
                    />
                  </label>
                )}
              </div>
            )}

            <Button type="submit" size="lg" loading={form.pending}>
              {t('day.save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
