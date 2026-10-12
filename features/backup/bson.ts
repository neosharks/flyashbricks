import mongoose from '@/lib/mongoose';

/**
 * The BSON library the MongoDB driver itself uses. A separately installed
 * `bson` would be a second copy whose ObjectId fails `instanceof` against the
 * driver's, so Extended JSON goes through the driver's own copy.
 */
export const { EJSON } = mongoose.mongo.BSON;
export type Document = mongoose.mongo.BSON.Document;
