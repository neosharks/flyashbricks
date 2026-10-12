import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';
import {
  AVATAR_VARIANTS,
  GENDERS,
  STAFF_ROLES,
  WAGE_TYPES,
  type Gender,
  type StaffRole,
  type WageType,
} from './constants';

/**
 * Someone who works at the plant. Most never sign in: labourers and drivers
 * are records an admin or supervisor keeps. Those who do use the app are
 * linked to their login account through `userId`.
 *
 * Names are kept in both scripts (see lib/bilingual.ts). `searchTerms` holds
 * lowercased words from both plus phone digits for prefix search.
 */
export type StaffMemberDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  name: string;
  nameHi: string | null;
  role: StaffRole;
  /** Free-text job title for display, e.g. "Night shift operator". */
  title: string | null;
  phone: string | null;
  wageType: WageType;
  /** Paise per day, per month, or per 1,000 bricks, by `wageType`. */
  wageRatePaise: number;
  /** Overtime paid per hour; null means none is paid. */
  overtimeRatePaise: number | null;
  joinedOn: Date | null;
  /** Set when someone leaves; their history stays. */
  leftOn: Date | null;
  isActive: boolean;
  userId: ObjectId | null;
  photoAssetId: ObjectId | null;
  /** 'unspecified' only for people added before gender was asked. */
  gender: Gender;
  /** Which cartoon picture shows when there is no photo; the person can change it. */
  avatarVariant: number;
  address: string | null;
  notes: string | null;
  searchTerms: string[];
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const StaffMemberSchema = new Schema<StaffMemberDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameHi: { type: String, default: null, trim: true, maxlength: 120 },
    role: { type: String, enum: STAFF_ROLES, required: true, default: 'labour' },
    title: { type: String, default: null, trim: true, maxlength: 80 },
    phone: { type: String, default: null, match: /^[1-9]\d{9}$/ },
    wageType: { type: String, enum: WAGE_TYPES, required: true, default: 'daily' },
    wageRatePaise: { type: Number, required: true, min: 0, default: 0 },
    overtimeRatePaise: { type: Number, default: null, min: 0 },
    joinedOn: { type: Date, default: null },
    leftOn: { type: Date, default: null },
    isActive: { type: Boolean, required: true, default: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    photoAssetId: { type: Schema.Types.ObjectId, ref: 'Asset', default: null },
    gender: { type: String, enum: GENDERS, required: true, default: 'unspecified' },
    avatarVariant: { type: Number, required: true, min: 0, max: AVATAR_VARIANTS - 1, default: 0 },
    address: { type: String, default: null, trim: true, maxlength: 300 },
    notes: { type: String, default: null, trim: true, maxlength: 1000 },
    searchTerms: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'staff_members', strict: 'throw' },
);

StaffMemberSchema.index({ orgId: 1, isActive: 1, name: 1, _id: 1 });
StaffMemberSchema.index({ orgId: 1, searchTerms: 1 });
StaffMemberSchema.index({ orgId: 1, role: 1, name: 1 });
StaffMemberSchema.index(
  { orgId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } },
);
StaffMemberSchema.index(
  { orgId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } },
);

export const StaffMember: Model<StaffMemberDoc> =
  (models.StaffMember as Model<StaffMemberDoc> | undefined) ??
  model<StaffMemberDoc>('StaffMember', StaffMemberSchema);
