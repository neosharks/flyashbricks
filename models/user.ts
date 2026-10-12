import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';
import { ACCESS_LEVELS, ROLES, type Permissions, type Role } from '@/lib/permissions';
import {
  AVATAR_VARIANTS,
  GENDERS,
  NOTIFICATION_CATEGORIES,
  type Gender,
  type NotificationCategory,
} from './constants';

export type ChannelPrefs = { email: boolean; sms: boolean; whatsapp: boolean };
/** Per category, which channels besides the in-app inbox a person wants. */
export type NotificationPrefs = Record<NotificationCategory, ChannelPrefs>;

export type UserDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  name: string;
  /** Hindi name (Devanagari); `name` is English. */
  nameHi: string | null;
  /** Login identifier: ten-digit Indian number, unique across every organisation. */
  phone: string;
  /** Optional; where alerts go. Also accepted as a login identifier. */
  email: string | null;
  jobTitle: string | null;
  passwordHash: string;
  role: Role;
  /** Ignored for admins, who have every permission. */
  permissions: Permissions;
  /** Set when an admin creates the account or resets its password. */
  mustChangePassword: boolean;
  /** When the temporary password stops working if it was never used. */
  temporaryPasswordExpiresAt: Date | null;
  notificationPrefs: NotificationPrefs;
  /** Language for email and SMS, which cannot read the browser's cookie. */
  locale: 'en' | 'hi';
  disabledAt: Date | null;
  /**
   * Tokens issued before this moment are refused. Bumped on password change,
   * disable, permission change and "sign out everywhere".
   */
  sessionsValidFrom: Date | null;
  lastLoginAt: Date | null;
  /** Optional photo; see models/asset.ts. */
  avatarAssetId: ObjectId | null;
  /** 'unspecified' only for people added before gender was asked. */
  gender: Gender;
  /** Which cartoon picture shows when there is no photo; the person can change it. */
  avatarVariant: number;
  createdBy: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

const level = { type: String, enum: ACCESS_LEVELS, required: true, default: 'none' as const };

const PermissionsSchema = new Schema<Permissions>(
  { rawMaterials: level, production: level, sales: level, staff: level, users: level },
  { _id: false },
);

const ChannelPrefsSchema = new Schema<ChannelPrefs>(
  {
    email: { type: Boolean, required: true, default: false },
    sms: { type: Boolean, required: true, default: false },
    whatsapp: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const NotificationPrefsSchema = new Schema<NotificationPrefs>(
  Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [
      category,
      { type: ChannelPrefsSchema, default: () => ({}) },
    ]),
  ),
  { _id: false },
);

const UserSchema = new Schema<UserDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameHi: { type: String, default: null, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, match: /^[1-9]\d{9}$/ },
    email: { type: String, default: null, lowercase: true, trim: true, maxlength: 254 },
    jobTitle: { type: String, default: null, trim: true, maxlength: 80 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'employee' },
    permissions: { type: PermissionsSchema, required: true, default: () => ({}) },
    mustChangePassword: { type: Boolean, required: true, default: true },
    temporaryPasswordExpiresAt: { type: Date, default: null },
    notificationPrefs: { type: NotificationPrefsSchema, default: () => ({}) },
    locale: { type: String, enum: ['en', 'hi'], required: true, default: 'en' },
    disabledAt: { type: Date, default: null },
    sessionsValidFrom: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    avatarAssetId: { type: Schema.Types.ObjectId, ref: 'Asset', default: null },
    gender: { type: String, enum: GENDERS, required: true, default: 'unspecified' },
    avatarVariant: { type: Number, required: true, min: 0, max: AVATAR_VARIANTS - 1, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'users', strict: 'throw' },
);

UserSchema.index({ phone: 1 }, { unique: true });
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);
UserSchema.index({ orgId: 1, name: 1, _id: 1 });
UserSchema.index({ orgId: 1, lastLoginAt: -1, _id: -1 });
UserSchema.index({ orgId: 1, createdAt: -1, _id: -1 });

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc> | undefined) ?? model<UserDoc>('User', UserSchema);
