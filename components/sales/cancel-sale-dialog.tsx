'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { FormErrors } from '@/components/ui/form-errors';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { voidSaleAction } from '@/features/sales/actions';
import { VoidSaleSchema } from '@/features/sales/schema';
import { useActionForm } from '@/hooks/use-action-form';

/** Cancelling a bill needs a written reason; it shows on the bill and in the log. */
export function CancelSaleDialog({ saleId }: { saleId: string }) {
  const t = useTranslations('sales.void');
  const tc = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useActionForm(
    voidSaleAction,
    () => {
      toast.success(t('done'));
      setOpen(false);
      router.refresh();
    },
    { schema: VoidSaleSchema },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger-soft" className="w-full sm:w-auto">
          <Ban aria-hidden />
          {t('button')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('title')} description={t('description')}>
        <form
          method="post"
          onSubmit={form.onSubmit}
          onChange={form.onChange}
          onBlur={form.onBlur}
          className="flex flex-col gap-4"
          noValidate
        >
          <FormErrors form={form} />
          <input type="hidden" name="saleId" value={saleId} />
          <Field label={t('reason')} required error={form.error('reason')}>
            {(props) => (
              <Textarea
                {...props}
                name="reason"
                rows={2}
                className="min-h-16"
                placeholder={t('reasonPlaceholder')}
                required
              />
            )}
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="danger" loading={form.pending}>
              {t('confirm')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
