import 'server-only';
import { open, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ConflictError } from '@/lib/errors';
import { RELEASE_TAG } from './version';

/**
 * The app never updates itself: it cannot reach Docker, by design. It writes
 * `request.json` into a folder shared with the host, where a systemd path
 * unit installed by deploy/proxmox/setup.sh picks it up, checks the version
 * against the repository's tags, and runs the update. The host reports back
 * through `status.json` and `update.log` in the same folder; `agent.json`
 * says an updater is installed at all.
 */
const FILES = {
  agent: 'agent.json',
  request: 'request.json',
  status: 'status.json',
  log: 'update.log',
} as const;

/** The last part of the log is enough to see what happened; builds print a lot. */
const LOG_TAIL_BYTES = 16 * 1024;

const StatusSchema = z.object({
  state: z.enum(['running', 'succeeded', 'failed']),
  version: z.string().max(64),
  from: z.string().max(64).nullish(),
  startedAt: z.string().max(40).nullish(),
  finishedAt: z.string().max(40).nullish(),
});

export type UpdateStatus = z.infer<typeof StatusSchema>;

export type UpdaterState = {
  /** An updater is installed on the host. */
  available: boolean;
  /** A request is waiting for the host to pick it up. */
  pending: boolean;
  status: UpdateStatus | null;
  log: string;
};

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function readStatus(dir: string): Promise<UpdateStatus | null> {
  try {
    const parsed = StatusSchema.safeParse(
      JSON.parse(await readFile(path.join(dir, FILES.status), 'utf8')),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function readLogTail(dir: string): Promise<string> {
  let handle;
  try {
    handle = await open(path.join(dir, FILES.log), 'r');
    const { size } = await handle.stat();
    const length = Math.min(size, LOG_TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, size - length);
    const text = buffer.toString('utf8');
    // Start at a whole line when the tail cut one in half.
    return size > length ? text.slice(text.indexOf('\n') + 1) : text;
  } catch {
    return '';
  } finally {
    await handle?.close();
  }
}

export async function readUpdaterState(dir: string | undefined): Promise<UpdaterState> {
  if (!dir || !(await exists(path.join(dir, FILES.agent)))) {
    return { available: false, pending: false, status: null, log: '' };
  }
  const [pending, status, log] = await Promise.all([
    exists(path.join(dir, FILES.request)),
    readStatus(dir),
    readLogTail(dir),
  ]);
  return { available: true, pending, status, log };
}

export function isBusy(state: UpdaterState): boolean {
  return state.pending || state.status?.state === 'running';
}

/**
 * Hands a release to the host. Written to a temporary name and renamed, so
 * the host never sees half a file.
 */
export async function writeUpdateRequest(
  dir: string,
  request: { version: string; requestedBy: string },
): Promise<void> {
  if (!RELEASE_TAG.test(request.version)) throw new Error(`Not a release tag: ${request.version}`);
  const target = path.join(dir, FILES.request);
  if (await exists(target)) {
    throw new ConflictError('UPDATE_IN_PROGRESS', 'An update is already waiting to start');
  }
  const temporary = path.join(dir, `.${FILES.request}.${process.pid}.tmp`);
  await writeFile(
    temporary,
    JSON.stringify({ ...request, requestedAt: new Date().toISOString() }),
    { mode: 0o644 },
  );
  await rename(temporary, target);
}
