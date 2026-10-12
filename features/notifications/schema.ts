import { z } from 'zod';
import { checkbox, objectId } from '@/lib/form-schema';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS } from '@/models/constants';
import type { NotificationPrefs } from '@/models/user';

export const NotificationIdSchema = z.object({ id: objectId() }).strict();

/**
 * The preferences form posts one checkbox per category and channel,
 * `pref_<category>_<channel>`; unchecked boxes are simply absent.
 */
export const PreferencesSchema = z
  .object(
    Object.fromEntries(
      NOTIFICATION_CATEGORIES.flatMap((category) =>
        NOTIFICATION_CHANNELS.map((channel) => [`pref_${category}_${channel}`, checkbox()]),
      ),
    ),
  )
  .strict()
  .transform(
    (flat) =>
      Object.fromEntries(
        NOTIFICATION_CATEGORIES.map((category) => [
          category,
          Object.fromEntries(
            NOTIFICATION_CHANNELS.map((channel) => [
              channel,
              (flat as Record<string, boolean>)[`pref_${category}_${channel}`] ?? false,
            ]),
          ),
        ]),
      ) as NotificationPrefs,
  );
