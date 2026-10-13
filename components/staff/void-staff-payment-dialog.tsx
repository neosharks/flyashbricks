'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { FormErrors } from '@/components/ui/form-errors';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { voidStaffPaymentAction } from '@/features/staff/actions';
import { VoidStaffPaymentSchema } from '@/features/staff/schema';
import { useActionForm } from '@/hooks/use-action-form';

/** Cancels a payment entered by mistake. It stays visible, crossed out, with the reason. */
export function VoidStaffPaymentDialog({ paymentId }: { paymentId: string }) {
  const t = useTranslations('staff.payment');
  const tc = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useActionForm(
    voidStaffPaymentAction,
    () => {
      toast.success(t('voidDone'));
      setOpen(false);
      router.refresh();
    },
    { schema: VoidStaffPaymentSchema },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-subtle">
          {t('void')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('voidTitle')} description={t('voidBody')}>
        <form
          method="post"
          onSubmit={form.onSubmit}
          onChange={form.onChange}
          onBlur={form.onBlur}
          className="flex flex-col gap-4"
          noValidate
        >
          <FormErrors form={form} />
          <input type="hidden" name="id" value={paymentId} />
          <Field label={t('voidReason')} required error={form.error('reason')}>
            {(props) => <Input {...props} name="reason" required />}
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="danger" loading={form.pending}>
              {t('voidConfirm')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
