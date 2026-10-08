// The montage lives in the project vault: IndexedDB, and the linked folder when there is one.

import { ensureActiveProject, writeBlob, writeText } from "../coffre/model.ts";
import { projectPath } from "../coffre/project.ts";
import type { VaultStore } from "../coffre/store.ts";
import type { AudioClip, Edit, VideoClip } from "./edit.ts";
import { parseSequenceFiche, sequenceFiche } from "./fiche.ts";

export function montageNote(id: string): string {
  return `Sequences/${id}-montage.md`;
}

function mapSource(source: string | null, slug: string, extensions: Record<string, string>): string | null {
  if (!source?.startsWith("local:")) return source;
  const id = source.slice("local:".length);
  if (!/^[a-z0-9-]+$/.test(id)) return source;
  const ext = extensions[id] ?? "wav";
  return projectPath(slug, `Sequences/${id}.${ext}`);
}

export function placeLocalSources(edit: Edit, slug: string, extensions: Record<string, string>): Edit {
  const video: VideoClip[] = edit.video.map(clip => ({ ...clip, source: mapSource(clip.source, slug, extensions) }));
  const audio: AudioClip[] = edit.audio.map(clip => ({ ...clip, source: mapSource(clip.source, slug, extensions) ?? clip.source }));
  return { ...edit, video, audio };
}

export async function readMontages(store: VaultStore, slug: string): Promise<Edit[]> {
  if (!/^[a-z0-9-]+$/.test(slug)) return [];
  const entries = await store.list();
  const pattern = new RegExp(`^Projets/${slug}/Sequences/([a-z0-9-]+)-montage\\.md$`);
  const edits: Edit[] = [];
  for (const entry of entries) {
    const match = pattern.exec(entry.path);
    if (!match || !entry.text) continue;
    const parsed = parseSequenceFiche(match[1], entry.text);
    if (parsed) edits.push(parsed);
  }
  return edits;
}

export async function writeMontageEdit(
  store: VaultStore,
  edit: Edit,
  files: Record<string, { blob: Blob; ext: string }> = {},
): Promise<Edit> {
  if (!/^[a-z0-9-]+$/.test(edit.id)) return edit;
  const slug = await ensureActiveProject(store);
  const extensions = Object.fromEntries(Object.entries(files).map(([id, file]) => [id, file.ext]));
  const placed = placeLocalSources(edit, slug, extensions);
  for (const [id, file] of Object.entries(files)) {
    if (!/^[a-z0-9-]+$/.test(id)) continue;
    await writeBlob(store, projectPath(slug, `Sequences/${id}.${file.ext}`), file.blob);
  }
  await writeText(store, projectPath(slug, montageNote(placed.id)), sequenceFiche(placed, slug));
  return placed;
}
