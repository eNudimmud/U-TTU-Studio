// Merge an exported vault ZIP into the coffre on this device. Files already
// here stay. A note that does not parse, or that points at a missing video or
// weight file, is left out so it cannot replace a prise or a personnage.

import { readFrontmatter } from "./markdown.ts";
import { COFFRE_ROOT, parseLora, parseTake, writeBlob, writeMap, writeText } from "./model.ts";
import { ACTIVE_FILE } from "./project.ts";
import { cleanPath, type VaultStore } from "./store.ts";
import { readZip } from "../zip.ts";

export interface CoffreMerge {
  written: number;
  skipped: number;
}

const ROOTS = new Set(["CANON.md", "README.md", "MOC.md", "jobs.md"]);

function allowedVaultPath(path: string): boolean {
  if (ROOTS.has(path) || path === ACTIVE_FILE) return true;
  if (/^(refs|scenes|clips|loras|prises|roles|\.uttu)\//.test(path)) return true;
  return /^Projets\/[a-z0-9-]+\/(?:_MOC|Bible|Style|Lexique|Journal)\.md$/.test(path)
    || /^Projets\/[a-z0-9-]+\/(?:Cast|Refs|Lieux|Prises|Sequences|Shots|Prompts|Templates|Moteurs|Assets|\.uttu)\/[^/]+$/.test(path);
}

function isSecret(path: string): boolean {
  return /(^|\/)(u-ttu-rendu|u-ttu-fal|u-ttu-blender)(\/|$)/i.test(path) || /\.key$/i.test(path);
}

/** A path inside the vault, after the export folder is stripped. Anything else is refused. */
export function vaultPathFromZip(name: string): string | null {
  const normalized = name.replace(/\\/g, "/");
  if (normalized.endsWith("/")) return null;
  const parts = normalized.split("/").filter(part => part && part !== ".");
  if (parts[0] === COFFRE_ROOT) parts.shift();
  if (parts.some(part => part === "..")) return null;
  const path = cleanPath(parts.join("/"));
  if (!path || !allowedVaultPath(path) || isSecret(path)) return null;
  return path;
}

function blobType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const types: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mkv: "video/x-matroska",
    avi: "video/avi",
    glb: "model/gltf-binary",
  };
  return types[ext] ?? "application/octet-stream";
}

function noteId(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base.endsWith("-fichier.md") ? base.slice(0, -"-fichier.md".length) : base.slice(0, -".md".length);
}

function acceptNote(path: string, text: string, future: ReadonlySet<string>): boolean {
  const prise = /(?:^prises\/|\/Prises\/)([A-Za-z0-9-]+)\.md$/.exec(path);
  if (prise) {
    const parsed = parseTake(prise[1], text);
    return Boolean(parsed && future.has(parsed.video));
  }
  if (/^loras\/.+\.md$/.test(path) || /\/Cast\/(?!canon\.md).+\.md$/.test(path) || /\/Lieux\/.+-fichier\.md$/.test(path)) {
    const parsed = parseLora(noteId(path), text);
    return Boolean(parsed && future.has(parsed.file));
  }
  const type = String(readFrontmatter(text).fields.type ?? "");
  if (path === "CANON.md" || path.endsWith("/Cast/canon.md")) return type === "look" || type === "personnage";
  if (/^scenes\/[a-z0-9-]+\.md$/.test(path) || /\/Lieux\/[a-z0-9-]+\.md$/.test(path)) return type === "scene" || type === "lieu";
  return true;
}

/** Adds the ZIP onto the coffre. The journal and the map are rewritten from what the coffre can still open. */
export async function mergeCoffreZip(store: VaultStore, archive: Uint8Array): Promise<CoffreMerge> {
  const planned: { path: string; data: Uint8Array }[] = [];
  let skipped = 0;
  for (const entry of readZip(archive)) {
    const path = vaultPathFromZip(entry.name);
    if (!path || path === "jobs.md" || path === "MOC.md" || path.endsWith("/_MOC.md") || path.endsWith("/Journal.md")) {
      skipped += 1;
      continue;
    }
    planned.push({ path, data: entry.data });
  }

  const future = new Set((await store.list()).map(file => file.path));
  for (const item of planned) {
    if (!item.path.endsWith(".md")) future.add(item.path);
  }

  let written = 0;
  const notes = planned.filter(item => item.path.endsWith(".md"));
  for (const item of planned) {
    if (item.path.endsWith(".md")) continue;
    if (item.path.endsWith(".json")) await writeText(store, item.path, new TextDecoder().decode(item.data));
    else await writeBlob(store, item.path, new Blob([item.data.slice()], { type: blobType(item.path) }));
    written += 1;
  }
  for (const item of notes) {
    const text = new TextDecoder().decode(item.data);
    if (!acceptNote(item.path, text, future)) {
      skipped += 1;
      continue;
    }
    await writeText(store, item.path, text);
    written += 1;
  }

  await writeMap(store);
  return { written, skipped };
}
