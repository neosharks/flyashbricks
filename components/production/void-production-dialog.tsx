'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Undo2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { voidProductionAction } from '@/features/production/actions';
import { useActionForm } from '@/hooks/use-action-form';

/** Cancels a wrong entry; asks why, because it rewrites stock on two sides. */
export function VoidProductionDialog({ id }: { id: string }) {
  const t = useTranslations('production.void');
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-subtle">
          <Undo2 aria-hidden />
          {t('button')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('title')} description={t('description')}>
        <VoidForm id={id} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function VoidForm({ id, onDone }: { id: string; onDone: () => void }) {
  const t = useTranslations('production');
  const router = useRouter();
  const form = useActionForm(voidProductionAction, () => {
    toast.success(t('toasts.voided'));
    onDone();
    router.refresh();
  });

  return (
    <form method="post" onSubmit={form.onSubmit} className="flex flex-col gap-4" noValidate>
      {form.formError && <Alert tone="danger">{form.formError}</Alert>}
      <input type="hidden" name="id" value={id} />
      <Field label={t('void.reason')} required error={form.error('reason')}>
        {(props) => (
          <Input {...props} name="reason" placeholder={t('void.reasonPlaceholder')} required />
        )}
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone}>
          {t('void.keep')}
        </Button>
        <Button type="submit" variant="danger" loading={form.pending}>
          {t('void.confirm')}
        </Button>
      </div>
    </form>
  );
}
