import type { StudioSession } from "../../components/app/studio-session.tsx";
import type { Resource, ProductionContext, MediaKind } from "./kernel/production.ts";
import type { StudioAction } from "./registry.ts";
import type { Edit } from "../montage/edit.ts";

export interface BoundResource extends Resource { path: string; }
/** Only the current project's hydrated media. Preview samples and arbitrary paths are excluded. */
export function projectResources(session: Pick<StudioSession, "studio" | "cast" | "decor" | "loose" | "media">): BoundResource[] {
  const { studio, media } = session;
  if (!studio.project) return [];
  const prefix = `Projets/${studio.project}/`;
  const resources: BoundResource[] = [];
  const add = (id: string, name: string, path: string | null | undefined, kind: MediaKind, role: Resource["role"]) => {
    if (!path?.startsWith(prefix) || path.split("/").some(s => s === ".." || s === ".")) return;
    resources.push({ id, name: name.slice(0, 100), path, kind, role, available: Boolean(media[path]) });
  };
  for (const card of session.cast) add(`cast:${card.id}`, card.name, card.sheet ?? card.photos[0], "image", "cast");
  for (const card of session.decor) add(`decor:${card.id}`, card.name, card.sheet, "image", "decor");
  for (const take of studio.takes) add(`take:${take.id}`, take.line || take.id, take.finalVideo ?? take.video, "video", "take");
  for (const asset of session.loose) {
    const kind: MediaKind = /\.(mp4|webm|mov)$/i.test(asset.media) ? "video" : /\.(wav|mp3|m4a|ogg)$/i.test(asset.media) ? "audio" : /\.(glb|gltf)$/i.test(asset.media) ? "mesh" : "image";
    if (!resources.some(r => r.path === asset.media)) add(`asset:${asset.id}`, asset.name, asset.media, kind, "asset");
  }
  return resources;
}

export function productionContext(session: Pick<StudioSession, "studio" | "cast" | "decor" | "loose" | "media">, operations: StudioAction[], selectedIds: string[], edits: Edit[] = [], receipts: Record<string, string[]> = {}): ProductionContext {
  const bound = projectResources(session);
  const resources = bound.map(({ path: _path, ...resource }) => resource);
  const evidence: Record<string, string[]> = {
    cast: resources.filter(r => r.role === "cast" && r.available).map(r => r.id),
    decor: resources.filter(r => r.role === "decor" && r.available).map(r => r.id),
    takes: resources.filter(r => r.role === "take" && r.available).map(r => r.id),
    shots: session.studio.shots.filter(s => s.composeur).map(s => s.id),
    montage: edits.filter(e => e.video.length > 0).map(e => `${e.id}:${revision(JSON.stringify(e))}`),
    ...receipts,
  };
  for (const op of operations.filter(op => op.toolId)) evidence[op.evidenceKey] = session.loose.filter(asset => op.gestureId && asset.geste === op.gestureId).filter(asset => resources.some(r => r.id === `asset:${asset.id}` && r.available)).map(asset => `asset:${asset.id}`);
  return { projectId: session.studio.project ?? "", projectName: session.studio.projectName, resources, selectedIds: selectedIds.filter(id => resources.some(r => r.id === id)), operations, evidence };
}
function revision(text: string): string { let hash = 2166136261; for (const ch of text) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619); return (hash >>> 0).toString(36); }
