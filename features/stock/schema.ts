import { z } from 'zod';
import { bilingualFields } from '@/lib/bilingual';
import { LIMITS } from '@/models/constants';
import {
  checkbox,
  count,
  dayKey,
  objectId,
  optionalText,
  quantity,
  rupeesOrZero,
} from '@/lib/form-schema';

/**
 * The recipe editor posts parallel `recipe_materialId` / `recipe_qty` fields,
 * one pair per row. They are zipped into one array before validation, and
 * blank rows (an empty last line in the editor) are dropped.
 */
export function foldRecipe(raw: Record<string, unknown>): Record<string, unknown> {
  const { recipe_materialId: ids, recipe_qty: qtys, ...rest } = raw;
  const list = (value: unknown): unknown[] =>
    Array.isArray(value) ? value : value === undefined ? [] : [value];
  const idList = list(ids);
  const qtyList = list(qtys);
  const recipe = idList
    .map((materialId, index) => ({ materialId, qtyMilli: qtyList[index] }))
    .filter(
      (line) => line.materialId !== '' || (line.qtyMilli !== '' && line.qtyMilli !== undefined),
    );
  return { ...rest, recipe };
}

const RecipeLineSchema = z
  .object({ materialId: objectId(), qtyMilli: quantity({ min: 1 }) })
  .strict();

/** Named in English and Hindi; either may be typed and fills the other. */
const name = bilingualFields('name', { max: 80, required: true, min: 2 });

const productFields = {
  ...name.shape,
  size: optionalText(60),
  defaultRatePaise: rupeesOrZero(),
  recipeBatchSize: count({ min: 1, max: 100_000 }),
  recipe: z
    .array(RecipeLineSchema)
    .max(LIMITS.recipeItems, 'tooBig')
    .refine((lines) => new Set(lines.map((line) => line.materialId)).size === lines.length, {
      message: 'duplicateMaterial',
    }),
  lowStockThreshold: count({ min: 0, max: LIMITS.bricksPerEntry }),
  isActive: checkbox(),
};

function bilingual<T extends Record<string, unknown>>(value: T) {
  const filled = name.complete(value);
  return { ...value, ...filled, name: filled.name ?? '' };
}

export const CreateProductSchema = z
  .object(productFields)
  .strict()
  .superRefine((value, ctx) => name.requireOne(value, ctx))
  .transform(bilingual);
export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = z
  .object({ id: objectId(), ...productFields })
  .strict()
  .superRefine((value, ctx) => name.requireOne(value, ctx))
  .transform(bilingual);
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

export const STOCK_ADJUST_MODES = ['add', 'remove', 'set'] as const;

export const AdjustStockSchema = z
  .object({
    productId: objectId(),
    mode: z.enum(STOCK_ADJUST_MODES, 'invalid'),
    qty: count({ min: 0, max: LIMITS.bricksPerEntry }),
    reason: z.string().trim().min(3, 'required').max(300, 'tooBig'),
    date: dayKey(),
  })
  .strict()
  .refine((value) => value.mode === 'set' || value.qty > 0, { message: 'tooSmall', path: ['qty'] });
export type AdjustStockInput = z.infer<typeof AdjustStockSchema>;
