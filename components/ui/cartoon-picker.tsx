'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, Shuffle, Smile } from 'lucide-react';
import { chooseCartoon } from '@/features/people/actions';
import { AVATAR_VARIANTS, type Gender } from '@/models/constants';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Dialog, DialogContent, DialogTrigger } from './dialog';
import { WorkerAvatar } from './worker-avatar';

const PAGE = 20;

/**
 * "Choose a picture": the cartoon gallery for one person. Twenty at a time
 * with a "show others" button, so it fits on a phone without scrolling.
 */
export function CartoonPicker({
  kind,
  id,
  gender,
  current,
  onChosen,
}: {
  kind: 'user' | 'staff';
  id: string;
  gender: Gender;
  current: number;
  onChosen?: (variant: number) => void;
}) {
  const t = useTranslations('common.cartoon');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(Math.floor(current / PAGE) * PAGE);
  const [selected, setSelected] = useState(current);
  const [pending, startTransition] = useTransition();

  const choose = (variant: number) => {
    setSelected(variant);
    startTransition(async () => {
      const result = await chooseCartoon({ kind, id, variant });
      if (result.ok) {
        toast.success(t('saved'));
        onChosen?.(variant);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Smile aria-hidden />
          {t('choose')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('title')} description={t('description')}>
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {Array.from({ length: PAGE }, (_, index) => (start + index) % AVATAR_VARIANTS).map(
            (variant) => (
              <li key={variant}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => choose(variant)}
                  aria-label={t('option', { number: variant + 1 })}
                  aria-pressed={selected === variant}
                  className={cn(
                    'relative block rounded-full p-0.5 transition',
                    selected === variant
                      ? 'ring-action ring-2 ring-offset-2'
                      : 'hover:ring-border-strong hover:ring-2',
                  )}
                >
                  <WorkerAvatar gender={gender} variant={variant} className="size-14 w-full" />
                  {selected === variant && (
                    <span className="bg-action text-action-foreground absolute right-0 bottom-0 rounded-full p-0.5">
                      <Check aria-hidden className="size-3" />
                    </span>
                  )}
                </button>
              </li>
            ),
          )}
        </ul>
        <Button
          variant="ghost"
          onClick={() => setStart((value) => (value + PAGE) % AVATAR_VARIANTS)}
        >
          <Shuffle aria-hidden />
          {t('more')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
