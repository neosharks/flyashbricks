'use server';

import { z } from 'zod';
import { runAction } from '@/lib/action';
import { recordAudit } from '@/lib/audit';
import { connectDb } from '@/lib/db';
import { env } from '@/lib/env';
import { AppError, ConflictError } from '@/lib/errors';
import { ok, type ActionResult } from '@/lib/result';
import { requirePermission } from '@/lib/session';
import { fetchLatestRelease } from './releases';
import { isBusy, readUpdaterState, writeUpdateRequest } from './updater';
import { isNewer, RELEASE_TAG } from './version';

const VersionSchema = z.string().regex(RELEASE_TAG);

/**
 * Asks the host to install `version`, the release the admin was shown. Only
 * the newest published release is ever accepted, so this cannot be used to
 * downgrade or to install anything that is not a tagged release.
 */
export async function requestUpdate(version: string): Promise<ActionResult<{ version: string }>> {
  return runAction('system.update', async () => {
    const actor = await requirePermission('system:update');
    const target = VersionSchema.safeParse(version);
    if (!target.success) {
      throw new AppError('UPDATE_VERSION_CHANGED', 'Not a release version', 400);
    }

    const dir = env.UPDATER_DIR;
    const state = await readUpdaterState(dir);
    if (!dir || !state.available) {
      throw new AppError('UPDATER_UNAVAILABLE', 'No updater is installed on this server', 503);
    }
    if (isBusy(state)) {
      throw new ConflictError('UPDATE_IN_PROGRESS', 'An update is already running');
    }

    const latest = await fetchLatestRelease(env.UPDATE_REPO, { fresh: true });
    if (!latest) throw new AppError('UPDATE_CHECK_FAILED', 'Could not reach GitHub', 502);
    if (latest.version !== target.data) {
      throw new ConflictError('UPDATE_VERSION_CHANGED', 'A different release is now the newest');
    }
    if (!isNewer(latest.version, env.APP_VERSION)) {
      throw new ConflictError('ALREADY_UP_TO_DATE', 'This server already runs that release');
    }

    await writeUpdateRequest(dir, { version: latest.version, requestedBy: actor.name });

    await connectDb();
    await recordAudit({
      actor,
      action: 'system.update',
      entity: 'System',
      entityId: latest.version,
      changes: { from: env.APP_VERSION, to: latest.version },
    });
    return ok({ version: latest.version });
  });
}
