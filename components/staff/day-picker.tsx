'use client';

import { useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { addDays } from '@/lib/dates';
import { intlLocale } from '@/lib/money';

/** Which day the sheet is for: previous / next arrows and a date box, never past today. */
export function DayPicker({ date, today, label }: { date: string; today: string; label: string }) {
  const tc = useTranslations('common');
  const tt = useTranslations('common.table');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const go = (day: string) =>
    startTransition(() => router.push(day === today ? pathname : `${pathname}?date=${day}`));
  const pretty = new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => go(addDays(date, -1))}
          aria-label={tt('previous')}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <label className="flex-1">
          <span className="sr-only">{label}</span>
          <Input
            type="date"
            value={date}
            max={today}
            onChange={(event) => event.target.value && go(event.target.value)}
          />
        </label>
        <Button
          variant="outline"
          size="icon"
          onClick={() => go(addDays(date, 1))}
          disabled={date >= today}
          aria-label={tt('next')}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <p className="text-foreground-muted flex items-center gap-2 text-sm font-medium">
        {pretty}
        {date === today && <span className="text-action">· {tc('today')}</span>}
        {pending && <Spinner label={tc('loading')} />}
      </p>
    </div>
  );
}
