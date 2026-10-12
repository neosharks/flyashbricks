'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ChevronDown, Pencil, Plus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { AmountInput } from '@/components/ui/amount-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { BilingualInput } from '@/components/ui/bilingual-input';
import { Field } from '@/components/ui/field';
import { Checkbox, Select } from '@/components/ui/input';
import { createMaterialAction, updateMaterialAction } from '@/features/raw-materials/actions';
import type { MaterialRow } from '@/features/raw-materials/types';
import { useActionForm } from '@/hooks/use-action-form';
import { quantityToInput } from '@/lib/quantity';
import { MATERIAL_KINDS, UNITS, type Unit } from '@/models/constants';

type Props = { material?: MaterialRow | undefined };

/** One dialog for adding and editing; editing cannot change the unit. */
export function MaterialDialog({ material }: Props) {
  const t = useTranslations('rawMaterials');
  const [open, setOpen] = useState(false);
  const editing = material !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="sm">
            <Pencil aria-hidden />
            {t('edit')}
          </Button>
        ) : (
          <Button size="lg" className="w-full sm:w-auto">
            <Plus aria-hidden />
            {t('add')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={editing ? t('form.editTitle', { name: material.name }) : t('form.createTitle')}
        description={t('form.description')}
      >
        <MaterialForm material={material} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function MaterialForm({ material, onDone }: Props & { onDone: () => void }) {
  const t = useTranslations('rawMaterials');
  const tc = useTranslations('common');
  const router = useRouter();
  const editing = material !== undefined;
  const [unit, setUnit] = useState<Unit>(material?.unit ?? 'kg');
  const [more, setMore] = useState(false);

  const create = useActionForm(createMaterialAction, () => {
    toast.success(t('toasts.created'));
    onDone();
    router.refresh();
  });
  const update = useActionForm(updateMaterialAction, () => {
    toast.success(t('toasts.updated'));
    onDone();
    router.refresh();
  });
  const form = editing ? update : create;
  const unitLabel = tc(`units.${unit}`);

  return (
    <form method="post" onSubmit={form.onSubmit} className="flex flex-col gap-4" noValidate>
      {form.formError && <Alert tone="danger">{form.formError}</Alert>}
      {editing && <input type="hidden" name="id" value={material.id} />}

      <BilingualInput
        label={t('form.name')}
        name="name"
        defaultEnglish={material?.nameEn}
        defaultHindi={material?.nameHi}
        required
        maxLength={80}
        errors={{ en: form.error('name'), hi: form.error('nameHi') }}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('form.kind')} required error={form.error('kind')}>
          {(props) => (
            <Select {...props} name="kind" defaultValue={material?.kind ?? 'fly_ash'}>
              {MATERIAL_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`kinds.${kind}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label={t('form.unit')}
          required
          hint={editing ? t('form.unitLocked') : undefined}
          error={form.error('unit')}
        >
          {(props) => (
            <Select
              {...props}
              name="unit"
              value={unit}
              disabled={editing}
              onChange={(event) => setUnit(event.target.value as Unit)}
            >
              {UNITS.map((option) => (
                <option key={option} value={option}>
                  {tc(`unitsLong.${option}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {!editing && (
        <Field
          label={t('form.opening')}
          hint={t('form.openingHint')}
          error={form.error('openingMilli')}
        >
          {(props) => <AmountInput {...props} name="openingMilli" suffix={unitLabel} />}
        </Field>
      )}

      <Field
        label={t('form.lowThreshold')}
        hint={t('form.lowThresholdHint')}
        required
        error={form.error('lowThresholdMilli')}
      >
        {(props) => (
          <AmountInput
            {...props}
            name="lowThresholdMilli"
            suffix={unitLabel}
            defaultValue={material ? quantityToInput(material.lowThresholdMilli) : ''}
            required
          />
        )}
      </Field>

      <button
        type="button"
        onClick={() => setMore((value) => !value)}
        aria-expanded={more}
        className="text-action inline-flex min-h-10 items-center gap-1 self-start text-sm font-medium"
      >
        <ChevronDown aria-hidden className={more ? 'size-4 rotate-180' : 'size-4'} />
        {more ? t('form.lessOptions') : t('form.moreOptions')}
      </button>

      {/* Kept mounted when hidden so their values still post. */}
      <div className={more ? 'flex flex-col gap-4' : 'hidden'}>
        <Field
          label={t('form.capacity')}
          hint={t('form.capacityHint')}
          error={form.error('capacityMilli')}
        >
          {(props) => (
            <AmountInput
              {...props}
              name="capacityMilli"
              suffix={unitLabel}
              defaultValue={material?.capacityMilli ? quantityToInput(material.capacityMilli) : ''}
            />
          )}
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="isActive" defaultChecked={material?.isActive ?? true} />
          {t('form.active')}
        </label>
      </div>

      <Button
        type="submit"
        size="lg"
        loading={form.pending}
        className="w-full sm:w-auto sm:self-end"
      >
        {editing ? t('form.save') : t('form.create')}
      </Button>
    </form>
  );
}
