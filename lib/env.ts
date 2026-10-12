import 'server-only';
import { publicEnv } from './public-env';
import { parseServerEnv } from './env-schema';

export const env = parseServerEnv();

export { publicEnv };
