import { addAudio, appendVideo, type Edit } from "../montage/edit.ts";
import type { BoundResource } from "./context.ts";
import type { AgentDraft } from "./execution.ts";

export type TimedResource = BoundResource & { seconds: number };

/** Stable clip identities make a saved handoff safe to replay after interruption.
 * Existing clips, trims and levels always win. No media URL is persisted. */
export function appendAgentMedia(edit: Edit, draft: AgentDraft, resources: TimedResource[]): Edit {
  let next = edit;
  for (const resource of resources) {
    const index = draft.resourceIds.indexOf(resource.id);
    if (index < 0 || !resource.available || resource.role !== "asset"
      || !["image", "video", "audio"].includes(resource.kind)
      || !resource.path.startsWith(`Projets/${draft.projectId}/`)
      || resource.path.includes("\\") || resource.path.split("/").some(part => !part || part === "." || part === "..")
      || !Number.isFinite(resource.seconds) || resource.seconds <= 0) throw new Error("resource");
    const id = `agent-${draft.stepId}-${index}`;
    const clip = { id, source: resource.path, label: resource.name, media: resource.seconds, start: 0, end: resource.seconds };
    if (resource.kind === "audio") {
      next = addAudio(next, { ...clip, track: "effets", at: 0, volume: 0.8, fadeIn: 0, fadeOut: 0 });
    } else {
      next = appendVideo(next, { ...clip, kind: resource.kind as "image" | "video", takeId: null });
    }
  }
  return next;
}

/** Only the hydrated local cache is read, never an arbitrary remote URL. */
export async function localMediaDuration(kind: "video" | "audio", url: string): Promise<number> {
  if (!url.startsWith("blob:")) throw new Error("Média absent du cache local.");
  const element = document.createElement(kind);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<number>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Lecture du média trop longue.")), 15000);
      element.onloadedmetadata = () => Number.isFinite(element.duration) && element.duration > 0
        ? resolve(element.duration) : reject(new Error("Durée du média illisible."));
      element.onerror = () => reject(new Error("Média impossible à lire."));
      element.preload = "metadata";
      element.src = url;
    });
  } finally {
    clearTimeout(timer);
    element.onloadedmetadata = null;
    element.onerror = null;
    element.removeAttribute("src");
    element.load();
  }
}
