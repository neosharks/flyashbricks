import { z } from 'zod';
import { GENDERS } from '@/models/constants';
import { bilingualFields } from '@/lib/bilingual';
import { ACCESS_LEVELS, MODULES, ROLES, type Permissions } from '@/lib/permissions';
import { checkbox, objectId, optionalEmail, optionalText, phone } from '@/lib/form-schema';

const level = z.enum(ACCESS_LEVELS, 'invalid');

/**
 * Access arrives from the form as `perm_<module>` radio values and is folded
 * into one object before validation, so the schema stays `.strict()`.
 */
export function foldPermissions(raw: Record<string, unknown>): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  const permissions: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('perm_')) permissions[key.slice(5)] = value;
    else rest[key] = value;
  }
  return { ...rest, permissions };
}

const PermissionsSchema = z
  .object(Object.fromEntries(MODULES.map((module) => [module, level.default('none')])))
  .strict() as unknown as z.ZodType<Permissions>;

/** Named in English and Hindi; either may be typed and fills the other. */
const name = bilingualFields('name', { max: 120, required: true, min: 2 });

/** Asked for everyone new; 'unspecified' only survives on accounts made before it was asked. */
const newGender = z.enum(['male', 'female', 'other'], 'chooseGender');

const fields = {
  ...name.shape,
  phone: phone(),
  email: optionalEmail(),
  jobTitle: optionalText(80),
  role: z.enum(ROLES, 'invalid'),
  permissions: PermissionsSchema,
  pinSignInAllowed: checkbox(),
};

function bilingual<T extends Record<string, unknown>>(value: T) {
  const filled = name.complete(value);
  return { ...value, ...filled, name: filled.name ?? '' };
}

export const CreateUserSchema = z
  .object({ ...fields, gender: newGender })
  .strict()
  .superRefine((value, ctx) => name.requireOne(value, ctx))
  .transform(bilingual);
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z
  .object({ id: objectId(), ...fields, gender: z.enum(GENDERS, 'chooseGender') })
  .strict()
  .superRefine((value, ctx) => name.requireOne(value, ctx))
  .transform(bilingual);
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const UserIdSchema = z.object({ id: objectId() }).strict();
