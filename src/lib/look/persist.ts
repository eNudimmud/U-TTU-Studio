// `.uttu/look.json` inside the active project. Missing file = no look.
// Undo writes the previous look back. It never deletes a picture.

import { ACTIVE_FILE, projectPath, projectSlug } from "../coffre/project.ts";
import type { VaultStore } from "../coffre/store.ts";
import { annulerLook, appliquerLook, documentVide, lireLook, lookJson, type LookChange, type LookDocument, type ProjectLook } from "./model.ts";

export const LOOK_FILE = ".uttu/look.json";

export function cheminLook(slug: string): string {
  return projectPath(slug, LOOK_FILE);
}

export async function projetActif(store: VaultStore): Promise<string | null> {
  try {
    const raw = JSON.parse((await store.get(ACTIVE_FILE))?.text ?? "null") as { actif?: unknown } | null;
    return typeof raw?.actif === "string" && projectSlug(raw.actif) === raw.actif ? raw.actif : null;
  } catch {
    return null;
  }
}

export async function lireLookProjet(store: VaultStore, slug: string): Promise<LookDocument> {
  const entry = await store.get(cheminLook(slug));
  return lireLook(entry?.text);
}

async function ecrire(store: VaultStore, slug: string, doc: LookDocument): Promise<void> {
  const path = cheminLook(slug);
  if (doc.look === null && doc.journal.length === 0 && doc.revision === 0) {
    await store.remove(path);
    return;
  }
  await store.put({ path, text: lookJson(doc), updatedAt: Date.now() });
}

/** Confirms a proposal. The only write. Nothing is posted to Comfy. */
export async function confirmerLook(store: VaultStore, slug: string, next: ProjectLook | null, at: string, id: string): Promise<LookChange> {
  const current = await lireLookProjet(store, slug);
  const change = appliquerLook(current.look || current.journal.length ? current : documentVide(), next, at, id);
  await ecrire(store, slug, change.document);
  return change;
}

/** Puts the previous look back. Pictures already stored are not removed. */
export async function annulerLookProjet(store: VaultStore, slug: string, at: string, id: string): Promise<LookChange> {
  const current = await lireLookProjet(store, slug);
  const change = annulerLook(current, at, id);
  await ecrire(store, slug, change.document);
  return change;
}
