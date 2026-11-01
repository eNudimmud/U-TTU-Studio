// CE2: the project journal and the cinema metadata sidecar.
//
// One operation = one journal file `.uttu/op-<uuid>.json`, written under the project lock BEFORE the
// metadata it changes. It keeps the SHA-256 of every target before and after, so a crash between two
// writes is finished on the next open, and a write nobody journaled (another tab, a hand edit, a sync)
// is seen as a conflict: both versions are kept, neither is overwritten.
//
// The journal only ever touches metadata (.json / .md). Media and Comfy jobs are never removed: undo is
// an inverse transaction, and rollback restores metadata only.
import type { VaultStore } from "../coffre/store.ts";
import { sha256Text } from "./digest.ts";
import { CinemaError, type JournalEntry, type Scope, type TakeProvenance } from "./types.ts";

export const JOURNAL_DIR = ".uttu";
export const journalPath = (operationId: string) => `${JOURNAL_DIR}/op-${safeId(operationId)}.json`;
export const cinemaMetaPath = (boardId: string) => `${JOURNAL_DIR}/cinema-${safeId(boardId)}.json`;
export const conflictPath = (path: string, operationId: string) => `${path}.conflict-${safeId(operationId)}`;
export const backupPath = (path: string, version: number) => `${JOURNAL_DIR}/backup/${path.split("/").pop()}.v${version}`;

function safeId(id: string): string {
  if (!/^[\w.-]{1,120}$/.test(id)) throw new CinemaError("STORAGE_UNAVAILABLE", "Identifiant d'opération invalide.");
  return id;
}

/** Only metadata may be written or restored by a transaction. Media are append-only. */
function assertMetadataPath(path: string): void {
  if (!/\.(json|md)$/.test(path) || path.includes("..")) throw new CinemaError("STORAGE_UNAVAILABLE", "Le journal n'écrit que des métadonnées.", [path]);
}

/** Runs `fn` with the project held. A port so a browser without Web Locks can still be journaled (hash checks catch the rest). */
export type ProjectLock = <T>(projectId: string, fn: () => Promise<T>) => Promise<T>;

export const noLock: ProjectLock = (_projectId, fn) => fn();

/** Web Locks when the browser has them. Without them, writes still run but `exclusive` is false: the hash checks stay the guard. */
export function browserProjectLock(locks: { request: (name: string, options: { mode: "exclusive" }, fn: () => Promise<unknown>) => Promise<unknown> } | null | undefined): { lock: ProjectLock; exclusive: boolean } {
  if (!locks) return { lock: noLock, exclusive: false };
  return { lock: <T>(projectId: string, fn: () => Promise<T>) => locks.request(`u-ttu-project-${projectId}`, { mode: "exclusive" }, fn) as Promise<T>, exclusive: true };
}

/** The stored journal: the contract entry plus the texts needed to finish or undo it. */
export interface StoredJournal extends JournalEntry {
  payload: { before: (string | null)[]; after: string[] };
  /** Paths where an unknown write was found; the journaled version waits next to it. */
  conflicts?: string[];
}

export interface Write { path: string; text: string }

export interface TransactionInput {
  operationId: string;
  scope: Scope;
  writes: Write[];
  inverseOf?: string;
  now: () => string;
}

const hashOf = (text: string | null | undefined) => (typeof text === "string" ? sha256Text(text) : Promise.resolve(null));

async function textAt(store: VaultStore, path: string): Promise<string | null> {
  const entry = await store.get(path);
  return typeof entry?.text === "string" ? entry.text : null;
}

async function putText(store: VaultStore, path: string, text: string, now: () => string): Promise<void> {
  try { await store.put({ path, text, updatedAt: Date.parse(now()) || 0 }); }
  catch (error) { throw new CinemaError("STORAGE_UNAVAILABLE", "Écriture impossible dans le coffre.", [path, error instanceof Error ? error.message : String(error)]); }
}

export async function readJournal(store: VaultStore, operationId: string): Promise<StoredJournal | null> {
  const raw = await textAt(store, journalPath(operationId));
  if (raw === null) return null;
  try {
    const entry = JSON.parse(raw) as StoredJournal;
    if (entry?.schemaVersion !== 1 || entry.operationId !== operationId || !Array.isArray(entry.targets)) throw new Error("shape");
    return entry;
  } catch { throw new CinemaError("STORAGE_UNAVAILABLE", "Journal illisible : rien n'est réécrit.", [journalPath(operationId)]); }
}

const writeJournal = (store: VaultStore, entry: StoredJournal, now: () => string) =>
  putText(store, journalPath(entry.operationId), JSON.stringify(entry, null, 2), now);

/**
 * Journal first, then the targets, then `applied`. Replaying the same operation id finishes it instead
 * of starting it again, so a crash anywhere is safe to retry.
 */
export async function runTransaction(store: VaultStore, lock: ProjectLock, input: TransactionInput): Promise<StoredJournal> {
  checkWrites(input.writes);
  return lock(input.scope.projectId, () => transactionHeld(store, input));
}

function checkWrites(writes: Write[]): void {
  writes.forEach(write => assertMetadataPath(write.path));
  if (new Set(writes.map(write => write.path)).size !== writes.length) throw new CinemaError("STORAGE_UNAVAILABLE", "Une cible apparaît deux fois.");
}

/**
 * Read → compute → journal → write under ONE acquisition of the project lock (CE2 R2). `compute`
 * reads the current files itself, inside the lock, so a write that landed before the lock was taken
 * is part of what it computes from, never overwritten by a stale calculation. Replaying the same id
 * finishes the stored journal and does not compute again. The journal is called with the lock held
 * (no re-entrance).
 */
export async function runComputedTransaction(
  store: VaultStore, lock: ProjectLock,
  input: Omit<TransactionInput, "writes"> & { compute: () => Promise<Write[]> },
): Promise<StoredJournal> {
  return lock(input.scope.projectId, async () => {
    const existing = await readJournal(store, input.operationId);
    if (existing) return finish(store, existing, input.now);
    const writes = await input.compute();
    checkWrites(writes);
    return transactionHeld(store, { ...input, writes });
  });
}

/** The transaction body; the caller holds the project lock. */
async function transactionHeld(store: VaultStore, input: TransactionInput): Promise<StoredJournal> {
  {
    const existing = await readJournal(store, input.operationId);
    if (existing) return finish(store, existing, input.now);
    const before = await Promise.all(input.writes.map(write => textAt(store, write.path)));
    const at = input.now();
    const entry: StoredJournal = {
      schemaVersion: 1,
      operationId: input.operationId,
      scope: input.scope,
      state: "prepared",
      targets: await Promise.all(input.writes.map(async (write, i) => ({ path: write.path, before: await hashOf(before[i]), after: await sha256Text(write.text) }))),
      ...(input.inverseOf ? { inverseOf: input.inverseOf } : {}),
      createdAt: at,
      updatedAt: at,
      payload: { before, after: input.writes.map(write => write.text) },
    };
    await writeJournal(store, entry, input.now);
    return finish(store, entry, input.now);
  }
}

/** Brings every target to its `after` text; a target that is neither before nor after is a conflict, kept side by side. */
async function finish(store: VaultStore, entry: StoredJournal, now: () => string): Promise<StoredJournal> {
  if (entry.state !== "prepared") return entry;
  const conflicts: string[] = [];
  for (const [i, target] of entry.targets.entries()) {
    const current = await hashOf(await textAt(store, target.path));
    if (current === target.after) continue;
    if (current === target.before) { await putText(store, target.path, entry.payload.after[i], now); continue; }
    await putText(store, conflictPath(target.path, entry.operationId), entry.payload.after[i], now);
    conflicts.push(target.path);
  }
  const done: StoredJournal = { ...entry, state: conflicts.length ? "conflict" : "applied", updatedAt: now(), ...(conflicts.length ? { conflicts } : {}) };
  await writeJournal(store, done, now);
  return done;
}

/** Finishes every journal left `prepared` (a crash between two writes). Run on open, without mounting any component. */
export async function recoverJournals(store: VaultStore, lock: ProjectLock, projectId: string, now: () => string): Promise<StoredJournal[]> {
  return lock(projectId, async () => {
    const entries = (await store.list()).filter(entry => /(^|\/)\.uttu\/op-[\w.-]+\.json$/.test(entry.path));
    const out: StoredJournal[] = [];
    for (const file of entries) {
      const id = /op-([\w.-]+)\.json$/.exec(file.path)![1];
      const entry = await readJournal(store, id);
      if (entry?.state === "prepared") out.push(await finish(store, entry, now));
    }
    return out;
  });
}

/**
 * Undo = a new transaction writing the `before` texts back. Refused (conflict, nothing written) when a
 * target changed since: an unknown write is never overwritten. A file the operation created is kept
 * (metadata only, never deleted by undo); the files it changed get their earlier text back.
 */
export async function undoTransaction(store: VaultStore, lock: ProjectLock, operationId: string, undoId: string, now: () => string): Promise<StoredJournal> {
  const entry = await readJournal(store, operationId);
  if (!entry || entry.state !== "applied") throw new CinemaError("REVISION_CONFLICT", "Rien d'appliqué à annuler.", [operationId]);
  const changed: string[] = [];
  for (const target of entry.targets) if (await hashOf(await textAt(store, target.path)) !== target.after) changed.push(target.path);
  if (changed.length) throw new CinemaError("REVISION_CONFLICT", "Le fichier a changé depuis : l'annulation ne l'écrase pas.", changed);
  const writes = entry.targets.flatMap((target, i) => entry.payload.before[i] === null ? [] : [{ path: target.path, text: entry.payload.before[i]! }]);
  const undo = await runTransaction(store, lock, { operationId: undoId, scope: entry.scope, writes, inverseOf: operationId, now });
  if (undo.state === "applied") await writeJournal(store, { ...entry, state: "rolled_back", updatedAt: now() }, now);
  return undo;
}

// ---------------------------------------------------------------- the cinema sidecar

export const CINEMA_META_VERSION = 1;

/** `.uttu/cinema-<boardId>.json`. Additive: unknown fields written by a newer build are preserved. */
export interface CinemaMeta {
  schemaVersion: number;
  boardId: string;
  /** Provenance of takes, by registre take id. Absent for older takes. */
  takes: Record<string, TakeProvenance>;
  /** Dedup keys of settled outputs: `${accountScope}|${providerJobId}|${outputIndex}`. */
  settled: string[];
  /** Current revision per shot (CE3 bumps it). A result for an older one becomes a variant. */
  revisions: Record<string, number>;
  /** Shots removed or archived: their takes stay in history, the shot is not brought back. */
  archived: string[];
  [unknown: string]: unknown;
}

export function emptyMeta(boardId: string): CinemaMeta {
  return { schemaVersion: CINEMA_META_VERSION, boardId, takes: {}, settled: [], revisions: {}, archived: [] };
}

/** Reads the sidecar. A future schema is refused, never rewritten by an older build. */
export function parseMeta(raw: string | null, boardId: string): CinemaMeta {
  if (raw === null) return emptyMeta(boardId);
  let data: Record<string, unknown>;
  try { data = JSON.parse(raw); } catch { throw new CinemaError("STORAGE_UNAVAILABLE", "Métadonnées cinéma illisibles : rien n'est réécrit.", [cinemaMetaPath(boardId)]); }
  const version = Number(data?.schemaVersion);
  if (!Number.isInteger(version) || version > CINEMA_META_VERSION) throw new CinemaError("STORAGE_UNAVAILABLE", "Métadonnées d'une version plus récente du studio.", [String(data?.schemaVersion)]);
  return {
    ...data,
    schemaVersion: version,
    boardId: typeof data.boardId === "string" ? data.boardId : boardId,
    takes: isRecord(data.takes) ? (data.takes as Record<string, TakeProvenance>) : {},
    settled: Array.isArray(data.settled) ? data.settled.filter((key): key is string => typeof key === "string") : [],
    revisions: isRecord(data.revisions) ? (data.revisions as Record<string, number>) : {},
    archived: Array.isArray(data.archived) ? data.archived.filter((id): id is string => typeof id === "string") : [],
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export const metaJson = (meta: CinemaMeta) => JSON.stringify(meta, null, 2);

// ---------------------------------------------------------------- migration

export interface Migration {
  path: string;
  currentVersion: number;
  /** Returns only the changed fields; ids and unknown fields are carried over untouched. */
  migrate: (data: Record<string, unknown>, from: number) => Record<string, unknown>;
  versionField?: string;
}

/**
 * Backed up (and read back) before any change, idempotent, refuses a future schema. Returns what it did.
 * Rollback = `restoreBackup`, which writes the saved text back; media are never touched.
 */
export async function migrateFile(store: VaultStore, lock: ProjectLock, projectId: string, migration: Migration, now: () => string): Promise<"absent" | "current" | "migrated"> {
  const field = migration.versionField ?? "schemaVersion";
  return lock(projectId, async () => {
    const raw = await textAt(store, migration.path);
    if (raw === null) return "absent";
    let data: Record<string, unknown>;
    try { data = JSON.parse(raw); } catch { throw new CinemaError("STORAGE_UNAVAILABLE", "Fichier illisible : pas de migration.", [migration.path]); }
    const from = Number(data[field] ?? 0);
    if (from > migration.currentVersion) throw new CinemaError("STORAGE_UNAVAILABLE", "Version plus récente : pas de migration.", [migration.path, String(from)]);
    if (from === migration.currentVersion) return "current";
    const backup = backupPath(migration.path, from);
    if ((await textAt(store, backup)) === null) await putText(store, backup, raw, now);
    if ((await textAt(store, backup)) !== raw) throw new CinemaError("STORAGE_UNAVAILABLE", "Sauvegarde non vérifiée : pas de migration.", [backup]);
    const next = { ...data, ...migration.migrate(data, from), [field]: migration.currentVersion };
    await putText(store, migration.path, JSON.stringify(next, null, 2), now);
    return "migrated";
  });
}

export async function restoreBackup(store: VaultStore, lock: ProjectLock, projectId: string, path: string, version: number, now: () => string): Promise<void> {
  assertMetadataPath(path);
  await lock(projectId, async () => {
    const saved = await textAt(store, backupPath(path, version));
    if (saved === null) throw new CinemaError("STORAGE_UNAVAILABLE", "Aucune sauvegarde à restaurer.", [path]);
    await putText(store, path, saved, now);
  });
}

/**
 * The project's own files, project-relative (`.uttu/…`, `Prises/…`), whatever project is open.
 * A late result writes through this view, so it can only land in the project it was sent from.
 */
export function projectFiles(store: VaultStore, slug: string): VaultStore {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new CinemaError("PROJECT_UNAVAILABLE", "Projet invalide.", [slug]);
  const prefix = `Projets/${slug}/`;
  const inside = (path: string) => {
    if (path.startsWith("/") || path.includes("..")) throw new CinemaError("PROJECT_UNAVAILABLE", "Chemin hors du projet.", [path]);
    return prefix + path;
  };
  return {
    list: async () => (await store.list()).filter(entry => entry.path.startsWith(prefix)).map(entry => ({ ...entry, path: entry.path.slice(prefix.length) })),
    get: async path => { const entry = await store.get(inside(path)); return entry ? { ...entry, path } : null; },
    put: entry => store.put({ ...entry, path: inside(entry.path) }),
    remove: path => store.remove(inside(path)),
  };
}
