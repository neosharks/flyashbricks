import { Schema, model, models, type Model, type ObjectId } from '@/lib/mongoose';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from './constants';

/**
 * One worker, one day. Marking again replaces the day's record (upsert on the
 * unique key), so correcting a mistake never creates a second entry.
 */
export type AttendanceDoc = {
  _id: ObjectId;
  orgId: ObjectId;
  staffId: ObjectId;
  /** Start of the day in the organisation's timezone. */
  date: Date;
  status: AttendanceStatus;
  /** Whole minutes of overtime. */
  overtimeMinutes: number;
  /** Bricks this person made, for piece-rate workers. */
  bricks: number;
  note: string | null;
  markedBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const AttendanceSchema = new Schema<AttendanceDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'StaffMember', required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    overtimeMinutes: { type: Number, required: true, min: 0, max: 24 * 60, default: 0 },
    bricks: { type: Number, required: true, min: 0, default: 0 },
    note: { type: String, default: null, trim: true, maxlength: 300 },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'attendance', strict: 'throw' },
);

AttendanceSchema.index({ orgId: 1, staffId: 1, date: 1 }, { unique: true });
// The daily sheet and period summaries.
AttendanceSchema.index({ orgId: 1, date: 1, staffId: 1 });

export const Attendance: Model<AttendanceDoc> =
  (models.Attendance as Model<AttendanceDoc> | undefined) ??
  model<AttendanceDoc>('Attendance', AttendanceSchema);
