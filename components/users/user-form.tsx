'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Bell, ShieldCheck, UserRound } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { BilingualInput } from '@/components/ui/bilingual-input';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { createUser, updateUser } from '@/features/users/actions';
import type { UserRow } from '@/features/users/types';
import { useActionForm } from '@/hooks/use-action-form';
import { NO_ACCESS, ROLES, type Permissions, type Role } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { Gender } from '@/models/constants';
import { AccessMatrix } from './access-matrix';
import { TemporaryPasswordDialog } from './temporary-password-dialog';

type UserFormProps = {
  /** Absent when creating. */
  user?: UserRow;
  /** Whether the person filling in the form is an admin (only admins can make admins). */
  actorIsAdmin: boolean;
  /** An employee manager may grant at most their own access. */
  ceiling: Permissions | null;
  /** Editing yourself: role and access are locked. */
  isSelf?: boolean;
};

export function UserForm({ user, actorIsAdmin, ceiling, isSelf = false }: UserFormProps) {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const router = useRouter();
  const editing = user !== undefined;

  const [role, setRole] = useState<Role>(user?.role ?? 'employee');
  const [permissions, setPermissions] = useState<Permissions>(user?.permissions ?? NO_ACCESS);
  const [email, setEmail] = useState(user?.email ?? '');
  const [issued, setIssued] = useState<{ id: string; name: string; password: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const tg = useTranslations('common.gender');
  const [gender, setGender] = useState<Gender>(user?.gender ?? 'unspecified');
  const locale = useLocale();

  const create = useActionForm(createUser, (data) => {
    toast.success(t('created'));
    // The name as the admin typed it, in the language they are reading.
    const fields = formRef.current ? new FormData(formRef.current) : null;
    const read = (key: string) => {
      const value = fields?.get(key);
      return typeof value === 'string' ? value : '';
    };
    const typed = read(locale === 'hi' ? 'nameHi' : 'name');
    const fallback = read(locale === 'hi' ? 'name' : 'nameHi');
    setIssued({ id: data.id, name: typed || fallback, password: data.temporaryPassword });
  });
  const update = useActionForm(updateUser, () => {
    toast.success(t('updated'));
    router.refresh();
  });
  const form = editing ? update : create;
  const lockAccess = isSelf;

  return (
    <>
      <form
        ref={formRef}
        method="post"
        onSubmit={form.onSubmit}
        className="flex flex-col gap-6"
        noValidate
      >
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
        {editing && <input type="hidden" name="id" value={user.id} />}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <BilingualInput
              label={t('form.name')}
              name="name"
              defaultEnglish={user?.nameEn}
              defaultHindi={user?.nameHi}
              required
              maxLength={120}
              errors={{ en: form.error('name'), hi: form.error('nameHi') }}
            />
          </div>
          <Field label={t('form.jobTitle')} error={form.error('jobTitle')}>
            {(props) => (
              <Input
                {...props}
                name="jobTitle"
                defaultValue={user?.jobTitle ?? ''}
                placeholder={t('form.jobTitlePlaceholder')}
              />
            )}
          </Field>
          <Field
            label={t('form.phone')}
            hint={t('form.phoneHint')}
            required
            error={form.error('phone')}
          >
            {(props) => (
              <Input
                {...props}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                defaultValue={user?.phone ?? ''}
                required
              />
            )}
          </Field>
          <Field label={t('form.email')} hint={t('form.emailHint')} error={form.error('email')}>
            {(props) => (
              <Input
                {...props}
                name="email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>
        </section>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            {tg('label')} <span className="text-danger">*</span>
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {(['male', 'female', 'other'] as const).map((option) => (
              <label
                key={option}
                className={cn(
                  'flex min-h-12 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors',
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
                {tg(option)}
              </label>
            ))}
          </div>
          {/* Accounts made before gender was asked keep "not set" until someone chooses. */}
          {gender === 'unspecified' && (
            <>
              <input type="hidden" name="gender" value="unspecified" />
              {editing && <p className="text-warning text-xs">{tg('notSet')}</p>}
            </>
          )}
          {form.error('gender') && (
            <p className="text-danger text-xs font-medium">{form.error('gender')}</p>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t('form.role')}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ROLES.map((option) => {
              const Icon = option === 'admin' ? ShieldCheck : UserRound;
              const blocked = lockAccess || (option === 'admin' && !actorIsAdmin);
              return (
                <label
                  key={option}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors',
                    role === option
                      ? 'border-action bg-action-subtle'
                      : 'border-border hover:bg-surface-muted',
                    blocked && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option}
                    checked={role === option}
                    disabled={blocked && role !== option}
                    onChange={() => setRole(option)}
                    className="accent-action mt-1"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Icon aria-hidden className="size-4" />
                      {t(`roles.${option}`)}
                    </span>
                    <span className="text-foreground-muted text-xs">
                      {t(`roleHints.${option}`)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {/* A disabled radio is not submitted; keep the locked value in the form. */}
          {lockAccess && <input type="hidden" name="role" value={role} />}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t('form.access')}</legend>
          <p className="text-foreground-muted -mt-1 mb-1 text-xs">{t('form.accessHint')}</p>
          <AccessMatrix
            value={permissions}
            onChange={setPermissions}
            disabled={role === 'admin' || lockAccess}
            ceiling={ceiling}
          />
          {(role === 'admin' || lockAccess) &&
            Object.entries(permissions).map(([module, level]) => (
              <input key={module} type="hidden" name={`perm_${module}`} value={level} />
            ))}
          {form.error('permissions') && (
            <p className="text-danger text-xs font-medium">{form.error('permissions')}</p>
          )}
        </fieldset>

        <p className="text-foreground-muted flex items-start gap-2 text-xs">
          <Bell aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {t('form.alertsHint')}
        </p>

        <div className="flex gap-2">
          <Button type="submit" loading={form.pending}>
            {form.pending ? tc('saving') : editing ? t('form.save') : t('form.create')}
          </Button>
        </div>
      </form>

      <TemporaryPasswordDialog
        name={issued?.name ?? ''}
        password={issued?.password ?? null}
        onDone={() => {
          const id = issued?.id;
          setIssued(null);
          if (id) router.push(`/users/${id}`);
        }}
      />
    </>
  );
}
