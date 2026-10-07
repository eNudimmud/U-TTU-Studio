// Merge an exported vault ZIP into the coffre on this device. Files already
// here stay. A note that does not parse, or that points at a missing video or
// weight file, is left out so it cannot replace a prise or a personnage.

import { readFrontmatter } from "./markdown.ts";
import { COFFRE_ROOT, jobsMarkdown, loadStudio, parseLora, parseTake, writeBlob, writeMap, writeText } from "./model.ts";
import { cleanPath, type VaultStore } from "./store.ts";
import { readZip } from "../zip.ts";

export interface CoffreMerge {
  written: number;
  skipped: number;
}

const ROOTS = new Set(["CANON.md", "README.md", "MOC.md", "jobs.md"]);

function allowedVaultPath(path: string): boolean {
  if (ROOTS.has(path)) return true;
  return /^(refs|scenes|clips|loras|prises|roles|\.uttu)\//.test(path);
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

function acceptNote(path: string, text: string, future: ReadonlySet<string>): boolean {
  const prise = /^prises\/([A-Za-z0-9-]+)\.md$/.exec(path);
  if (prise) {
    const parsed = parseTake(prise[1], text);
    return Boolean(parsed && future.has(parsed.video));
  }
  const lora = /^loras\/([A-Za-z0-9-]+)\.md$/.exec(path);
  if (lora) {
    const parsed = parseLora(lora[1], text);
    return Boolean(parsed && future.has(parsed.file));
  }
  if (path === "CANON.md") return readFrontmatter(text).fields.type === "look";
  if (/^scenes\/[a-z0-9-]+\.md$/.test(path)) return readFrontmatter(text).fields.type === "scene";
  return true;
}

/** Adds the ZIP onto the coffre. The journal and the map are rewritten from what the coffre can still open. */
export async function mergeCoffreZip(store: VaultStore, archive: Uint8Array): Promise<CoffreMerge> {
  const planned: { path: string; data: Uint8Array }[] = [];
  let skipped = 0;
  for (const entry of readZip(archive)) {
    const path = vaultPathFromZip(entry.name);
    if (!path || path === "jobs.md" || path === "MOC.md") {
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

  const studio = await loadStudio(store);
  await writeText(store, "jobs.md", jobsMarkdown(studio.takes, studio.loras));
  await writeMap(store);
  return { written, skipped };
}
