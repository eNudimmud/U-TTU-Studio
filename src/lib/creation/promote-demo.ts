// P0-2: copy example references into the active project so Vidéo keeps every chip
// and routes to PRISE (vault: true). Fetch + writeBlob only — no Comfy spend.

import { castNote } from "./fiche.ts";
import { assetPaths } from "./assets.ts";
import type { ExempleRefSpec } from "./exemple-galerie.ts";
import { emptySceneDraft, ensureActiveProject, writeBlob, writeScene, writeText } from "../coffre/model.ts";
import { projectVault } from "../render/recovery.ts";
import type { VaultStore } from "../coffre/store.ts";
import { assetPath } from "../site.ts";

export interface PromotedRef {
  kind: "cast" | "decor";
  id: string;
  name: string;
  src: string;
  path: string;
  vault: true;
}

const memory = new Map<string, PromotedRef>();

function mimeOf(path: string): string {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return "image/webp";
}

function stableId(demoId: string): string {
  // Keep a readable, stable id so fillBarre can find the card after reload.
  return demoId.startsWith("demo-") ? demoId.replace(/^demo-/, "ex-") : `ex-${demoId}`;
}

/** Fetch a public example and write it into Cast/ or Decors/ under a stable id. Idempotent. */
export async function promoteDemoRef(store: VaultStore, spec: ExempleRefSpec): Promise<PromotedRef> {
  const id = stableId(spec.demoId);
  const hit = memory.get(id);
  if (hit) return hit;

  const project = await ensureActiveProject(store);
  const vault = projectVault(store, project);
  const ext = (spec.preview.split(".").pop() || "webp").toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
  const kind = spec.kind === "cast" ? "personnage" : "decor";
  const paths = assetPaths(project, kind, id, ext);

  const existing = await vault.get(paths.media);
  if (!existing?.blob) {
    const res = await fetch(assetPath(spec.preview));
    if (!res.ok) throw new Error(`Exemple introuvable (${spec.demoId}).`);
    const blob = await res.blob();
    const file = new File([blob], `${spec.name}.${ext}`, { type: blob.type || mimeOf(spec.preview) });
    await writeBlob(vault, paths.media, file);
    const at = new Date().toISOString();
    if (kind === "personnage") {
      await writeText(vault, paths.note, castNote({
        id, name: spec.name, at, prompt: "", source: "photos",
        photos: [paths.media], sheet: paths.media, template: "", quote: 0, cost: 0, project,
      }));
    } else {
      await writeScene(vault, {
        ...emptySceneDraft(), id, name: spec.name,
        stills: [paths.media], render: paths.media, home: "Decors",
        source: "photo", template: "", devis: 0, cout: 0,
      });
    }
  }

  const promoted: PromotedRef = {
    kind: spec.kind, id, name: spec.name,
    src: assetPath(spec.preview), path: paths.media, vault: true,
  };
  memory.set(id, promoted);
  return promoted;
}

export async function promoteDemoRefs(store: VaultStore, specs: readonly ExempleRefSpec[]): Promise<PromotedRef[]> {
  const out: PromotedRef[] = [];
  for (const spec of specs) out.push(await promoteDemoRef(store, spec));
  return out;
}

export function clearPromoteCache(): void {
  memory.clear();
}
