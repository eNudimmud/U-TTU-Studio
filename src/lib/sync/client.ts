import { containedIn, manifestHash, syncDecision, validateManifest, type ProjectManifest, type SyncState } from "./manifest.ts";

export const SYNC_BASE = "/studio-sync/projects";
export const DEVICE_FLAG = "u-ttu-sync-device";
const stateKey = (project: string) => `u-ttu-sync:${project}`;

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
type Fetch = typeof fetch;
interface Remote { revision: number; hash: string; updatedAt: string; manifest?: ProjectManifest }

export function readState(storage: Storage, project: string): SyncState | null {
  try {
    const raw = JSON.parse(storage.getItem(stateKey(project)) ?? "null");
    return raw && Number.isInteger(raw.revision) && raw.revision > 0 && typeof raw.hash === "string" ? { revision: raw.revision, hash: raw.hash } : null;
  } catch { return null; }
}
export function writeState(storage: Storage, project: string, state: SyncState): void { storage.setItem(stateKey(project), JSON.stringify(state)); }

export class SyncError extends Error {}

async function call(doFetch: Fetch, token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const response = await doFetch(path, { ...init, cache: "no-store", credentials: "omit", headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}) } });
  if (response.status === 401) throw new SyncError("sync.auth");
  if (response.status === 404 && (await response.clone().json().catch(() => ({}))).error === "disabled") throw new SyncError("sync.disabled");
  return response;
}

export async function fetchRemote(doFetch: Fetch, token: string, project: string): Promise<Remote | null> {
  const response = await call(doFetch, token, `${SYNC_BASE}/${project}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new SyncError("sync.server");
  const body = await response.json() as Remote;
  const checked = validateManifest(body.manifest, project);
  if (!checked.ok) throw new SyncError("sync.server");
  return { ...body, manifest: checked.manifest };
}

export type PushResult = { ok: true; revision: number; hash: string } | { ok: false; current: { revision: number; hash: string } | null };

export async function pushManifest(doFetch: Fetch, token: string, manifest: ProjectManifest, baseRevision: number): Promise<PushResult> {
  const response = await call(doFetch, token, `${SYNC_BASE}/${manifest.project}`, { method: "PUT", body: JSON.stringify({ baseRevision, manifest }) });
  if (response.status === 409) return { ok: false, current: (await response.json()).current ?? null };
  if (response.status === 413) throw new SyncError("sync.size");
  if (response.status === 429) throw new SyncError("sync.quota");
  if (response.status === 422) throw new SyncError("sync.refused");
  if (!response.ok) throw new SyncError("sync.server");
  const body = await response.json();
  return { ok: true, revision: body.revision, hash: body.hash };
}

export type SyncOutcome =
  | { kind: "same" | "pushed" | "pulled"; revision: number }
  | { kind: "conflict"; local: number; remote: number };

export interface SyncIo {
  fetch: Fetch;
  storage: Storage;
  token(): Promise<string | null>;
  notes(): Promise<{ manifest: ProjectManifest }>;
  apply(manifest: ProjectManifest): Promise<unknown>;
}

async function tokenOf(io: SyncIo): Promise<string> {
  const token = await io.token();
  if (!token) throw new SyncError("sync.auth");
  return token;
}

/** One explicit sync. Never overwrites a side that changed since the last sync: that is a conflict. */
export async function syncProject(io: SyncIo, project: string): Promise<SyncOutcome> {
  const token = await tokenOf(io);
  const { manifest } = await io.notes();
  if (manifest.project !== project) throw new SyncError("sync.project");
  const hash = await manifestHash(manifest);
  const state = readState(io.storage, project);
  const remote = await fetchRemote(io.fetch, token, project);
  const action = syncDecision(hash, state, remote, remote?.manifest ? containedIn(manifest, remote.manifest) : false);
  if (action.kind === "same") { writeState(io.storage, project, { revision: remote!.revision, hash }); return { kind: "same", revision: remote!.revision }; }
  if (action.kind === "conflict") return action;
  if (action.kind === "pull") {
    await io.apply(remote!.manifest!);
    writeState(io.storage, project, { revision: remote!.revision, hash: remote!.hash });
    return { kind: "pulled", revision: remote!.revision };
  }
  const pushed = await pushManifest(io.fetch, token, manifest, action.baseRevision);
  if (!pushed.ok) return { kind: "conflict", local: state?.revision ?? 0, remote: pushed.current?.revision ?? 0 };
  writeState(io.storage, project, { revision: pushed.revision, hash: pushed.hash });
  return { kind: "pushed", revision: pushed.revision };
}

/** The person chose a side after a conflict. "server": the device takes the server notes (a recovery copy is kept). "device": the server takes this device's notes. */
export async function resolveConflict(io: SyncIo, project: string, keep: "server" | "device"): Promise<SyncOutcome> {
  const token = await tokenOf(io);
  const remote = await fetchRemote(io.fetch, token, project);
  if (keep === "server") {
    if (!remote) throw new SyncError("sync.server");
    await io.apply(remote.manifest!);
    writeState(io.storage, project, { revision: remote.revision, hash: remote.hash });
    return { kind: "pulled", revision: remote.revision };
  }
  const { manifest } = await io.notes();
  const pushed = await pushManifest(io.fetch, token, manifest, remote?.revision ?? 0);
  if (!pushed.ok) return { kind: "conflict", local: readState(io.storage, project)?.revision ?? 0, remote: pushed.current?.revision ?? 0 };
  writeState(io.storage, project, { revision: pushed.revision, hash: pushed.hash });
  return { kind: "pushed", revision: pushed.revision };
}
