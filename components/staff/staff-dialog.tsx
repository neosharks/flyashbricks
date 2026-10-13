'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Pencil, UserPlus } from 'lucide-react';
import { AmountInput } from '@/components/ui/amount-input';
import { BilingualInput } from '@/components/ui/bilingual-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Disclosure } from '@/components/ui/disclosure';
import { FormErrors } from '@/components/ui/form-errors';
import { Field, Fieldset } from '@/components/ui/field';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/input';
import { createStaffAction, updateStaffAction } from '@/features/staff/actions';
import { CreateStaffSchema, UpdateStaffSchema } from '@/features/staff/schema';
import type { StaffRow } from '@/features/staff/types';
import { useActionForm } from '@/hooks/use-action-form';
import { paiseToInput } from '@/lib/money';
import { cn } from '@/lib/utils';
import {
  STAFF_ROLES,
  WAGE_TYPES,
  type Gender,
  type StaffRole,
  type WageType,
} from '@/models/constants';
import { ROLE_ICONS } from './role-icon';
import { useStaffErrors } from './use-staff-errors';
import { WorkerAvatar } from '@/components/ui/worker-avatar';

type Login = { id: string; name: string; phone: string };

/**
 * Add or edit a worker. Only the name is needed; the work they do is a row of
 * big picture buttons, and pay is "₹ per day / month / 1,000 bricks" in words.
 * Rarely needed fields wait under "More options".
 */
export function StaffDialog({
  staff,
  logins,
  today,
  defaultRates,
}: {
  staff?: StaffRow;
  logins: Login[];
  today: string;
  /** Prefill for a new worker; editing uses the stored values. */
  defaultRates?: { wageRatePaise: number };
}) {
  const t = useTranslations('staff');
  const tc = useTranslations('common');
  const router = useRouter();
  const translateError = useStaffErrors();
  const editing = staff !== undefined;
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<StaffRole>(staff?.role ?? 'labour');
  const [gender, setGender] = useState<Gender | null>(
    staff && staff.gender !== 'unspecified' ? staff.gender : null,
  );
  const tg = useTranslations('common.gender');
  const [wageType, setWageType] = useState<WageType>(staff?.wageType ?? 'daily');
  const [active, setActive] = useState(staff?.isActive ?? true);

  const onSaved = () => {
    toast.success(editing ? t('form.saved') : t('form.created'));
    setOpen(false);
    router.refresh();
  };
  const create = useActionForm(createStaffAction, onSaved, {
    schema: CreateStaffSchema,
    translate: translateError,
  });
  const update = useActionForm(updateStaffAction, onSaved, {
    schema: UpdateStaffSchema,
    translate: translateError,
  });
  const form = editing ? update : create;
  const error = form.error;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="outline">
            <Pencil aria-hidden />
            {t('detail.edit')}
          </Button>
        ) : (
          <Button size="lg" className="w-full sm:w-auto">
            <UserPlus aria-hidden />
            {t('add')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={editing ? t('form.editTitle', { name: staff.name }) : t('form.createTitle')}
        description={t('form.description')}
        className="sm:max-w-2xl"
      >
        {/* Remounts per person, so switching records never shows stale values. */}
        <form
          key={staff?.id ?? 'new'}
          method="post"
          onSubmit={form.onSubmit}
          onChange={form.onChange}
          onBlur={form.onBlur}
          className="flex flex-col gap-5"
          noValidate
        >
          <FormErrors form={form} />
          {editing && <input type="hidden" name="id" value={staff.id} />}

          <BilingualInput
            label={t('form.name')}
            name="name"
            defaultEnglish={staff?.name ?? null}
            defaultHindi={staff?.nameHi ?? null}
            required
            maxLength={120}
            errors={{ en: error('name'), hi: error('nameHi') }}
          />

          <Fieldset
            legend={tg('label')}
            required
            hint={staff?.gender === 'unspecified' ? tg('notSet') : undefined}
            error={error('gender')}
          >
            <div className="grid grid-cols-3 gap-2">
              {(['male', 'female', 'other'] as const).map((option) => (
                <label
                  key={option}
                  className={cn(
                    'flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-medium',
                    gender === option
                      ? 'border-action bg-action-subtle text-action'
                      : 'border-border hover:bg-surface-muted',
                  )}
                >
                  <input
                    type="radio"
                    name="gender"
                    value={option}
                    checked={gender === option}
                    onChange={() => setGender(option)}
                    className="sr-only"
                  />
                  <WorkerAvatar
                    gender={option}
                    variant={staff?.avatarVariant ?? 0}
                    className="size-7"
                  />
                  {tg(option)}
                </label>
              ))}
            </div>
          </Fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('form.role')}</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {STAFF_ROLES.map((option) => {
                const Icon = ROLE_ICONS[option];
                return (
                  <label
                    key={option}
                    className={cn(
                      'flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center text-xs font-medium',
                      role === option
                        ? 'border-action bg-action-subtle text-action'
                        : 'border-border hover:bg-surface-muted',
                    )}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={option}
                      checked={role === option}
                      onChange={() => setRole(option)}
                      className="sr-only"
                    />
                    <Icon aria-hidden className="size-5" />
                    {t(`roles.${option}`)}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-medium">{t('form.wageType')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {WAGE_TYPES.map((option) => (
                <label
                  key={option}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-2 text-center text-sm font-medium',
                    wageType === option
                      ? 'border-action bg-action-subtle text-action'
                      : 'border-border-strong hover:bg-surface-muted',
                  )}
                >
                  <input
                    type="radio"
                    name="wageType"
                    value={option}
                    checked={wageType === option}
                    onChange={() => setWageType(option)}
                    className="sr-only"
                  />
                  {t(`wageTypes.${option}`)}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('form.wageRate')} required error={error('wageRatePaise')}>
                {(props) => (
                  <AmountInput
                    {...props}
                    name="wageRatePaise"
                    prefix="₹"
                    suffix={t(`wageTypes.${wageType}`)}
                    defaultValue={paiseToInput(
                      staff?.wageRatePaise ?? defaultRates?.wageRatePaise ?? 0,
                    )}
                  />
                )}
              </Field>
              <Field
                label={t('form.overtimeRate')}
                hint={t('form.overtimeHint')}
                error={error('overtimeRatePaise')}
              >
                {(props) => (
                  <AmountInput
                    {...props}
                    name="overtimeRatePaise"
                    prefix="₹"
                    defaultValue={
                      staff?.overtimeRatePaise ? paiseToInput(staff.overtimeRatePaise) : ''
                    }
                  />
                )}
              </Field>
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('form.phone')} hint={t('form.phoneHint')} error={error('phone')}>
              {(props) => (
                <Input
                  {...props}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="98765 43210"
                  defaultValue={staff?.phone ?? ''}
                />
              )}
            </Field>
            <Field label={t('form.joinedOn')} error={error('joinedOn')}>
              {(props) => (
                <Input
                  {...props}
                  name="joinedOn"
                  type="date"
                  max={today}
                  defaultValue={staff?.joinedOn ?? ''}
                />
              )}
            </Field>
          </div>

          <label className="flex min-h-11 items-center gap-3 text-sm">
            <Checkbox
              name="isActive"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            {t('form.isActive')}
          </label>

          <Disclosure
            summary={tc('moreOptions')}
            defaultOpen={Boolean(staff?.leftOn ?? staff?.userId)}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('form.title')} error={error('title')}>
                {(props) => (
                  <Input
                    {...props}
                    name="title"
                    placeholder={t('form.titlePlaceholder')}
                    defaultValue={staff?.title ?? ''}
                  />
                )}
              </Field>
              <Field label={t('form.leftOn')} hint={t('form.leftOnHint')} error={error('leftOn')}>
                {(props) => (
                  <Input
                    {...props}
                    name="leftOn"
                    type="date"
                    max={today}
                    defaultValue={staff?.leftOn ?? ''}
                  />
                )}
              </Field>
              <Field
                label={t('form.login')}
                hint={t('form.loginHint')}
                error={error('userId')}
                className="sm:col-span-2"
              >
                {(props) => (
                  <Select {...props} name="userId" defaultValue={staff?.userId ?? ''}>
                    <option value="">{t('form.noLogin')}</option>
                    {logins.map((login) => (
                      <option key={login.id} value={login.id}>
                        {login.name} · {login.phone}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('form.address')} error={error('address')} className="sm:col-span-2">
                {(props) => <Input {...props} name="address" defaultValue={staff?.address ?? ''} />}
              </Field>
              <Field label={t('form.notes')} error={error('notes')} className="sm:col-span-2">
                {(props) => <Textarea {...props} name="notes" defaultValue={staff?.notes ?? ''} />}
              </Field>
            </div>
          </Disclosure>

          <Button
            type="submit"
            size="lg"
            loading={form.pending}
            className="w-full sm:w-auto sm:self-start"
          >
            {form.pending ? tc('saving') : editing ? t('form.save') : t('form.create')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
