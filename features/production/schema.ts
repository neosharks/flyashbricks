import { z } from 'zod';
import { LIMITS } from '@/models/constants';
import { count, dayKey, objectId, optionalText } from '@/lib/form-schema';

export const LogProductionSchema = z
  .object({
    productId: objectId(),
    date: dayKey(),
    goodQty: count({ min: 0, max: LIMITS.bricksPerEntry }),
    defectiveQty: z.preprocess(
      (value) => (value === '' || value === undefined ? 0 : value),
      count({ min: 0, max: LIMITS.bricksPerEntry }),
    ),
    note: optionalText(500),
  })
  .strict()
  .refine((value) => value.goodQty + value.defectiveQty > 0, {
    message: 'nothingProduced',
    path: ['goodQty'],
  });
export type LogProductionInput = z.infer<typeof LogProductionSchema>;

export const VoidProductionSchema = z
  .object({
    id: objectId(),
    reason: z.string().trim().min(3, 'required').max(300, 'tooBig'),
  })
  .strict();
export type VoidProductionInput = z.infer<typeof VoidProductionSchema>;
