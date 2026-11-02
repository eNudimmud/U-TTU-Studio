// D1 · a headless way out of a conflicted intent (PR #228, question 1).
//
// `resolveConflictedIntent(operationId, "abandon")` writes `event: "intent.abandoned"` on the
// conflict journal and nothing else. The board, the sidecar and the conflict copies stay as they
// are. Rebase is a later decision. Removing this command needs no migration: `event` is optional
// and a conflict journal without it still means "not applied".
import type { VaultStore } from "../coffre/store.ts";
import { journalPath, readJournal, type ProjectLock, type StoredJournal } from "./journal.ts";
import { CinemaError } from "./types.ts";

export async function resolveConflictedIntent(
  store: VaultStore,
  lock: ProjectLock,
  operationId: string,
  resolution: "abandon",
  now: () => string,
): Promise<StoredJournal> {
  if (resolution !== "abandon") throw new CinemaError("REVISION_CONFLICT", "Seul l'abandon est disponible.", [String(resolution)]);
  const found = await readJournal(store, operationId);
  if (!found || found.state !== "conflict") throw new CinemaError("REVISION_CONFLICT", "Aucune intention en conflit à abandonner.", [operationId]);
  return lock(found.scope.projectId, async () => {
    const entry = await readJournal(store, operationId);
    if (!entry || entry.state !== "conflict") throw new CinemaError("REVISION_CONFLICT", "Aucune intention en conflit à abandonner.", [operationId]);
    if (entry.event === "intent.abandoned") return entry;
    const next: StoredJournal = { ...entry, event: "intent.abandoned", updatedAt: now() };
    const text = JSON.stringify(next, null, 2);
    try { await store.put({ path: journalPath(entry.operationId), text, updatedAt: Date.parse(now()) || 0 }); }
    catch (error) { throw new CinemaError("STORAGE_UNAVAILABLE", "L'abandon n'a pas pu être écrit.", [error instanceof Error ? error.message : ""]); }
    const written = await readJournal(store, operationId);
    if (written?.event !== "intent.abandoned" || written.state !== "conflict") throw new CinemaError("STORAGE_UNAVAILABLE", "L'abandon n'a pas pu être relu.");
    return written;
  });
}
