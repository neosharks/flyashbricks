import { z } from 'zod';
import { bilingualFields } from '@/lib/bilingual';
import { MATERIAL_KINDS, UNITS } from '@/models/constants';
import {
  checkbox,
  dayKey,
  objectId,
  optionalText,
  quantity,
  rupeesOrZero,
} from '@/lib/form-schema';

const optionalQuantity = () =>
  z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    quantity().nullable(),
  );

/** Named in English and Hindi; either may be typed and fills the other. */
const name = bilingualFields('name', { max: 80, required: true, min: 2 });

const materialFields = {
  ...name.shape,
  kind: z.enum(MATERIAL_KINDS, 'invalid'),
  unit: z.enum(UNITS, 'invalid'),
  lowThresholdMilli: quantity(),
  capacityMilli: optionalQuantity(),
  isActive: checkbox(),
};

function bilingual<T extends Record<string, unknown>>(value: T) {
  const filled = name.complete(value);
  return { ...value, ...filled, name: filled.name ?? '' };
}

export const CreateMaterialSchema = z
  .object({ ...materialFields, openingMilli: optionalQuantity() })
  .strict()
  .superRefine((value, ctx) => name.requireOne(value, ctx))
  .transform(bilingual);
export type CreateMaterialInput = z.infer<typeof CreateMaterialSchema>;

/** The unit is fixed after creation: changing it would silently rescale every movement. */
export const UpdateMaterialSchema = z
  .object({ id: objectId(), ...materialFields, unit: z.enum(UNITS, 'invalid').optional() })
  .strict()
  .superRefine((value, ctx) => name.requireOne(value, ctx))
  .transform(bilingual);
export type UpdateMaterialInput = z.infer<typeof UpdateMaterialSchema>;

export const PurchaseSchema = z
  .object({
    materialId: objectId(),
    qtyMilli: quantity({ min: 1 }),
    costPaise: rupeesOrZero(),
    supplier: optionalText(120),
    date: dayKey(),
    note: optionalText(500),
  })
  .strict();
export type PurchaseInput = z.infer<typeof PurchaseSchema>;

export const ADJUST_MODES = ['add', 'remove', 'set'] as const;

export const AdjustMaterialSchema = z
  .object({
    materialId: objectId(),
    mode: z.enum(ADJUST_MODES, 'invalid'),
    qtyMilli: quantity(),
    reason: z.string().trim().min(3, 'required').max(300, 'tooBig'),
    date: dayKey(),
  })
  .strict()
  .refine((value) => value.mode === 'set' || value.qtyMilli > 0, {
    message: 'tooSmall',
    path: ['qtyMilli'],
  });
export type AdjustMaterialInput = z.infer<typeof AdjustMaterialSchema>;
