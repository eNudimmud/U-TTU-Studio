// A synced project carries only its text notes (Markdown, JSON). Never media bytes,
// keys, cookies, blob/data URLs or signed links. The vault stays the local source.

export const MANIFEST_VERSION = 1;
export const MAX_MANIFEST_BYTES = 1_048_576;
export const MAX_FILES = 2_000;
export const PROJECT_ID = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const FILE = /^(?:[._]?[A-Za-z0-9][A-Za-z0-9._ -]{0,80}\/)?[._]?[A-Za-z0-9][A-Za-z0-9._ -]{0,80}\.(?:md|json|txt|csv|canvas)$/;
/** Device-only files: never leave the device, never overwritten by a pull. */
const LOCAL_ONLY = /^\.uttu\/sync[^/]*\.json$/;
const SECRET = [
  /\b(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9]{8,}/,
  /\bcomfyui-[A-Za-z0-9]{16,}/i,
  /\bBearer\s+[A-Za-z0-9._-]{20,}/,
  /\b(?:blob|data):[a-z]/i,
  /[?&](?:X-Amz-Signature|X-Goog-Signature|Signature|sig|token|access_token|api_key)=/i,
  /\bpostgres(?:ql)?:\/\/[^\s"']*@/i,
];

export interface ProjectManifest { version: 1; project: string; files: Record<string, string> }
export interface SyncState { revision: number; hash: string }
export type ManifestError = "project" | "shape" | "file" | "secret" | "size";

export function manifestBytes(m: ProjectManifest): number { return new TextEncoder().encode(JSON.stringify(m)).length; }

/** Why a file may not be synced, or null when it may. */
export function fileRefusal(path: string, text: string): ManifestError | null {
  if (!FILE.test(path) || path.includes("..") || LOCAL_ONLY.test(path)) return "file";
  if (SECRET.some(re => re.test(text))) return "secret";
  return null;
}

/** Strict check, server and client alike. */
export function validateManifest(raw: unknown, project?: string): { ok: true; manifest: ProjectManifest } | { ok: false; error: ManifestError } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "shape" };
  const m = raw as Record<string, unknown>;
  if (m.version !== MANIFEST_VERSION || typeof m.project !== "string" || !m.files || typeof m.files !== "object" || Array.isArray(m.files)) return { ok: false, error: "shape" };
  if (!PROJECT_ID.test(m.project) || (project !== undefined && m.project !== project)) return { ok: false, error: "project" };
  const entries = Object.entries(m.files as Record<string, unknown>);
  if (entries.length > MAX_FILES) return { ok: false, error: "size" };
  const files: Record<string, string> = {};
  for (const [path, text] of entries) {
    if (typeof text !== "string") return { ok: false, error: "shape" };
    const refusal = fileRefusal(path, text);
    if (refusal) return { ok: false, error: refusal };
    files[path] = text;
  }
  const manifest: ProjectManifest = { version: 1, project: m.project, files };
  if (manifestBytes(manifest) > MAX_MANIFEST_BYTES) return { ok: false, error: "size" };
  return { ok: true, manifest };
}

/** Stable SHA-256 of the sorted files, to know whether the device changed since its last sync. */
export async function manifestHash(m: ProjectManifest): Promise<string> {
  const sorted = Object.keys(m.files).sort().map(k => [k, m.files[k]]);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([m.project, sorted])));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

export type SyncAction =
  | { kind: "same" }
  | { kind: "push"; baseRevision: number }
  | { kind: "pull" }
  | { kind: "conflict"; local: number; remote: number };

/**
 * What one device should do, given its last sync (state), its current hash and the server row.
 * Never overwrites silently: a change on both sides since the last sync is a conflict.
 * localInRemote: every local note already exists, identical, on the server.
 */
export function syncDecision(localHash: string, state: SyncState | null, remote: { revision: number; hash: string } | null, localInRemote = false): SyncAction {
  if (!remote) return { kind: "push", baseRevision: 0 };
  if (remote.hash === localHash) return { kind: "same" };
  // A device that never synced and holds nothing the server lacks loses nothing by pulling.
  const localChanged = state ? state.hash !== localHash : !localInRemote;
  const remoteChanged = !state || remote.revision !== state.revision;
  if (localChanged && remoteChanged) return { kind: "conflict", local: state?.revision ?? 0, remote: remote.revision };
  if (remoteChanged) return { kind: "pull" };
  return { kind: "push", baseRevision: remote.revision };
}

interface Store { list(): Promise<{ path: string; text?: string }[]>; get(path: string): Promise<{ text?: string } | null>; put(entry: { path: string; text: string; updatedAt: number }): Promise<void> }

/** Collects the project's syncable notes. Media and refused files stay on the device and are listed. */
export async function collectManifest(store: Store, project: string): Promise<{ manifest: ProjectManifest; skipped: string[] }> {
  if (!PROJECT_ID.test(project)) throw new Error("sync.project");
  const prefix = `Projets/${project}/`;
  const files: Record<string, string> = {};
  const skipped: string[] = [];
  for (const entry of await store.list()) {
    if (!entry.path.startsWith(prefix)) continue;
    const rel = entry.path.slice(prefix.length);
    if (typeof entry.text !== "string") continue; // media bytes: never synced
    if (LOCAL_ONLY.test(rel)) continue;
    if (fileRefusal(rel, entry.text)) { skipped.push(rel); continue; }
    files[rel] = entry.text;
  }
  const manifest: ProjectManifest = { version: 1, project, files };
  if (manifestBytes(manifest) > MAX_MANIFEST_BYTES) throw new Error("sync.size");
  return { manifest, skipped };
}

export const BACKUP_FILE = ".uttu/sync-backup.json";

/**
 * Writes the server notes into the vault. A recovery copy of the replaced notes is kept first.
 * Nothing is deleted: notes missing on the server stay on the device.
 */
export async function applyManifest(store: Store, manifest: ProjectManifest, now = Date.now()): Promise<number> {
  const checked = validateManifest(manifest);
  if (!checked.ok) throw new Error(`sync.${checked.error}`);
  const prefix = `Projets/${manifest.project}/`;
  const replaced: Record<string, string> = {};
  for (const [rel, text] of Object.entries(manifest.files)) {
    const current = (await store.get(prefix + rel))?.text;
    if (current !== undefined && current !== text) replaced[rel] = current;
  }
  await store.put({ path: prefix + BACKUP_FILE, text: JSON.stringify({ version: 1, project: manifest.project, at: new Date(now).toISOString(), files: replaced }), updatedAt: now });
  let written = 0;
  for (const [rel, text] of Object.entries(manifest.files)) {
    if ((await store.get(prefix + rel))?.text === text) continue;
    await store.put({ path: prefix + rel, text, updatedAt: now });
    written++;
  }
  return written;
}

/** True when every note of `local` exists with the same text in `remote`. */
export function containedIn(local: ProjectManifest, remote: ProjectManifest): boolean {
  return Object.entries(local.files).every(([path, text]) => remote.files[path] === text);
}
