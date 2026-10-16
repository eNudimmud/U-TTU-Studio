// Graphs for the video gestures of PRISE: raccord (LTX-2.5 first/last frame),
// caméra (LTX-2.3 IC-LoRA), élargir (LTX-2.3 outpainting LoRA) and effacer
// (LTX-2.3 object-removal LoRA). Same rule as the take: only the visitor's
// files, text and seed are patched into the official graph.

import type { ApiGraph } from "./take-graph.ts";
import { VIDEO_BRIDGE_BASE, VIDEO_CAMERA_BASE, VIDEO_OUTPAINT_BASE, VIDEO_REMOVE_BASE } from "./video-gestes-base.ts";

export const VIDEO_GESTES = ["prise-raccord", "prise-camera", "prise-elargir", "prise-effacer"] as const;
export type VideoGesteId = (typeof VIDEO_GESTES)[number];

export const VIDEO_GESTE_PREFIX: Record<VideoGesteId, string> = {
  "prise-raccord": "uttu/raccord",
  "prise-camera": "uttu/camera",
  "prise-elargir": "uttu/elargir",
  "prise-effacer": "uttu/effacer",
};

/** Whether the gesture needs the visitor's text. Élargir works without one. */
export const VIDEO_GESTE_TEXT: Record<VideoGesteId, boolean> = {
  "prise-raccord": true,
  "prise-camera": true,
  "prise-elargir": false,
  "prise-effacer": true,
};

export interface VideoGesteInput {
  geste: VideoGesteId;
  /** Uploaded input names keyed by registry slot (image_1, image_2, video_1). */
  files: Readonly<Record<string, string>>;
  prompt: string;
  seed: number;
}

export function isVideoGeste(id: string): id is VideoGesteId {
  return (VIDEO_GESTES as readonly string[]).includes(id);
}

function need(files: Readonly<Record<string, string>>, slot: string): string {
  const name = files[slot];
  if (typeof name !== "string" || !name.trim()) throw new Error(`Fichier manquant : ${slot}.`);
  return name;
}

function finish(graph: ApiGraph, geste: VideoGesteId, seed: number): ApiGraph {
  for (const node of Object.values(graph)) {
    if (node.class_type === "RandomNoise") node.inputs.noise_seed = seed;
    if (node.class_type === "KSampler") node.inputs.seed = seed;
    if (node.class_type === "SaveVideo" || node.class_type === "VHS_VideoCombine") node.inputs.filename_prefix = VIDEO_GESTE_PREFIX[geste];
  }
  return graph;
}

export function videoGesteGraph(input: VideoGesteInput): ApiGraph {
  const prompt = input.prompt.trim();
  if (VIDEO_GESTE_TEXT[input.geste] && !prompt) throw new Error("Le texte est vide.");
  const seed = Number.isSafeInteger(input.seed) && input.seed >= 0 ? input.seed : 0;
  if (input.geste === "prise-raccord") {
    const graph = structuredClone(VIDEO_BRIDGE_BASE);
    graph["31"].inputs.image = need(input.files, "image_1");
    graph["39"].inputs.image = need(input.files, "image_2");
    graph["251:252"].inputs.value = prompt;
    graph["251:250"].inputs.value = false;
    return finish(graph, input.geste, seed);
  }
  if (input.geste === "prise-camera") {
    const graph = structuredClone(VIDEO_CAMERA_BASE);
    graph["200"].inputs.image = need(input.files, "image_1");
    graph["199"].inputs.file = need(input.files, "video_1");
    graph["129:211"].inputs.on_false = prompt;
    graph["129:209"].inputs.prompt = prompt;
    graph["129:212"].inputs.value = false;
    return finish(graph, input.geste, seed);
  }
  if (input.geste === "prise-elargir") {
    const graph = structuredClone(VIDEO_OUTPAINT_BASE);
    graph["5060"].inputs.video = need(input.files, "video_1");
    graph["5151:5138"].inputs.text = prompt;
    return finish(graph, input.geste, seed);
  }
  const graph = structuredClone(VIDEO_REMOVE_BASE);
  graph["39"].inputs.file = need(input.files, "video_1");
  graph["54:9"].inputs.text = prompt;
  return finish(graph, input.geste, seed);
}
