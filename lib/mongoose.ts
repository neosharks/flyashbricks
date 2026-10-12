import mongoose from 'mongoose';

/**
 * Single import point for Mongoose.
 *
 * Mongoose ships CommonJS, and several of its exports are getters that Node's
 * CJS/ESM interop cannot see. `import { models } from 'mongoose'` therefore
 * works under a bundler and throws under plain Node — which is exactly the gap
 * between `next dev` and `pnpm db:seed`. Destructuring the default export here
 * works in both, so every call site imports from this module instead.
 */
export const { Schema, model, models, Types } = mongoose;

/** `Types` above is a value binding, so the type meaning needs its own alias. */
export type ObjectId = mongoose.Types.ObjectId;

export type {
  ClientSession,
  HydratedDocument,
  Model,
  PipelineStage,
  QueryFilter,
  UpdateQuery,
} from 'mongoose';

export default mongoose;
