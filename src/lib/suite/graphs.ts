// « Et ensuite ? » : the next step on an asset or a take. Each tool is one official Comfy
// template (suite/base.ts), open weights, with only files, text, seed, frame and the output
// name patched in. Pure functions: nothing here opens a network.
//
// Finaliser enhances what exists (SeedVR2 restores and enlarges, interpolation adds in-between
// frames). It never regenerates the image or the take.

import { kleinNodes } from "../render/klein-graph.ts";
import type { ApiGraph } from "../render/take-graph.ts";
import {
  BIREFNET_BASE, H3_I2V_BASE, INTERPOLATION_BASE, KLEIN9B_EXTEND_BASE, LTX23_IA2V_BASE, SEEDVR2_IMAGE_BASE, SEEDVR2_VIDEO_BASE,
} from "./base.ts";

export const SUITE_GESTES = [
  "suite-modifier",
  "suite-finaliser-image",
  "suite-detourer",
  "suite-elargir",
  "suite-animer",
  "suite-finaliser-video",
  "suite-fluidifier",
  "suite-prolonger",
  "suite-parler",
] as const;
export type SuiteGeste = (typeof SUITE_GESTES)[number];

export function isSuiteGeste(id: string): id is SuiteGeste {
  return (SUITE_GESTES as readonly string[]).includes(id);
}

/** What the tool returns. Images are PNG, videos MP4. */
export const SUITE_SORTIE: Record<SuiteGeste, "image" | "video"> = {
  "suite-modifier": "image",
  "suite-finaliser-image": "image",
  "suite-detourer": "image",
  "suite-elargir": "image",
  "suite-animer": "video",
  "suite-finaliser-video": "video",
  "suite-fluidifier": "video",
  "suite-prolonger": "video",
  "suite-parler": "video",
};

/** What the tool starts from. */
export const SUITE_SOURCE: Record<SuiteGeste, "image" | "video"> = {
  "suite-modifier": "image",
  "suite-finaliser-image": "image",
  "suite-detourer": "image",
  "suite-elargir": "image",
  "suite-animer": "image",
  "suite-finaliser-video": "video",
  "suite-fluidifier": "video",
  "suite-prolonger": "video",
  "suite-parler": "image",
};

/** The visitor text is required for these. */
export const SUITE_TEXTE: Record<SuiteGeste, "requis" | "facultatif" | "aucun"> = {
  "suite-modifier": "requis",
  "suite-finaliser-image": "aucun",
  "suite-detourer": "aucun",
  "suite-elargir": "facultatif",
  "suite-animer": "requis",
  "suite-finaliser-video": "aucun",
  "suite-fluidifier": "aucun",
  "suite-prolonger": "facultatif",
  "suite-parler": "requis",
};

export const SUITE_PREFIX: Record<SuiteGeste, string> = {
  "suite-modifier": "uttu-modifie",
  "suite-finaliser-image": "uttu-finalise",
  "suite-detourer": "uttu-detoure",
  "suite-elargir": "uttu-elargi",
  "suite-animer": "video/uttu-anime",
  "suite-finaliser-video": "video/uttu-finalise",
  "suite-fluidifier": "video/uttu-fluide",
  "suite-prolonger": "video/uttu-prolonge",
  "suite-parler": "video/uttu-parle",
};

/** Video length sent to the engine, in seconds. One fixed length keeps one estimate. */
export const SUITE_SECONDS = 5;
/** Lip-sync length cap. The voice is trimmed to it. */
export const PARLER_MAX_SECONDS = 5;
/** Finaliser vidéo: the shorter side after restoration. */
export const FINAL_SHORTER = 1080;

export type Elargir = "cotes" | "haut-bas" | "tout";
export type SuiteAspect = "horizontal" | "vertical";

export interface SuiteInput {
  geste: SuiteGeste;
  /** Uploaded input names. `source` is the image or video; `audio` the voice (Faire parler). */
  files: { source: string; audio?: string };
  prompt: string;
  seed: number;
  aspect?: SuiteAspect;
  elargir?: Elargir;
  /** Finaliser vidéo: add in-between frames in the same pass. */
  fluidifier?: boolean;
  /** Finaliser vidéo: long clips are processed in chunks. */
  seconds?: number;
}

type Link = [string, number];

function seedOf(seed: number): number {
  return Number.isSafeInteger(seed) && seed >= 0 ? seed : 0;
}

function safeName(name: string | undefined, what: string): string {
  if (!name || /[\\\u0000]/.test(name)) throw new Error(`${what} manquant.`);
  return name;
}

function saveImage(graph: ApiGraph, from: Link, prefix: string): void {
  graph.save = { class_type: "SaveImage", inputs: { images: from, filename_prefix: prefix }, _meta: { title: "Enregistrer" } };
}

function modifier(input: SuiteInput): ApiGraph {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Le texte est vide.");
  const graph: ApiGraph = {
    load: { class_type: "LoadImage", inputs: { image: safeName(input.files.source, "Image") }, _meta: { title: "Image" } },
  };
  Object.assign(graph, kleinNodes({ prefix: "klein_", prompt: `${prompt}\n\nKeep everything else as it is. No text.`, seed: input.seed, aspect: "16:9", images: [["load", 0]] }));
  saveImage(graph, ["klein_decode", 0], SUITE_PREFIX["suite-modifier"]);
  return graph;
}

function finaliserImage(input: SuiteInput): ApiGraph {
  const graph = structuredClone(SEEDVR2_IMAGE_BASE);
  graph["1"].inputs.image = safeName(input.files.source, "Image");
  graph["66:54"].inputs.seed = seedOf(input.seed);
  // ×2: enough for a still from the studio (≈ 1 MP), still light on the GPU.
  graph["66:57"].inputs["resize_type.multiplier"] = 2;
  graph["9"].inputs.filename_prefix = SUITE_PREFIX["suite-finaliser-image"];
  return graph;
}

function detourer(input: SuiteInput): ApiGraph {
  const graph = structuredClone(BIREFNET_BASE);
  graph["17"].inputs.image = safeName(input.files.source, "Image");
  graph.save.inputs.filename_prefix = SUITE_PREFIX["suite-detourer"];
  return graph;
}

/** Pixels added on each side, on the 1.5 MP working copy. */
export function elargirPads(side: Elargir): { left: number; top: number; right: number; bottom: number } {
  if (side === "haut-bas") return { left: 0, top: 384, right: 0, bottom: 384 };
  if (side === "tout") return { left: 256, top: 256, right: 256, bottom: 256 };
  return { left: 384, top: 0, right: 384, bottom: 0 };
}

function elargir(input: SuiteInput): ApiGraph {
  const graph = structuredClone(KLEIN9B_EXTEND_BASE);
  graph["159"].inputs.image = safeName(input.files.source, "Image");
  Object.assign(graph["164"].inputs, elargirPads(input.elargir ?? "cotes"));
  const extra = input.prompt.trim();
  // The template's instruction fills the green band; the visitor text says what appears there.
  graph["157"].inputs.text = extra ? `remove the green part, continue the scene: ${extra}` : "remove the green part";
  graph["135"].inputs.noise_seed = seedOf(input.seed);
  graph["142"].inputs.filename_prefix = SUITE_PREFIX["suite-elargir"];
  return graph;
}

function finishVideo(graph: ApiGraph, saveId: string, prefix: string): void {
  // Format stays the template's « auto » (MP4 / H.264 on Comfy Cloud).
  graph[saveId].inputs.filename_prefix = prefix;
}

function h3(input: SuiteInput, geste: "suite-animer" | "suite-prolonger"): ApiGraph {
  const graph = structuredClone(H3_I2V_BASE);
  const prompt = input.prompt.trim();
  if (geste === "suite-animer" && !prompt) throw new Error("Le texte est vide.");
  graph["114"].inputs.image = safeName(input.files.source, "Image");
  graph["115"].inputs.aspect_ratio = input.aspect === "vertical" ? "9:16 (Portrait Widescreen)" : "16:9 (Widescreen)";
  graph["105:104"].inputs.prompt = geste === "suite-prolonger"
    ? (prompt ? `The shot continues from this exact frame. ${prompt}` : "")
    : prompt;
  graph["105:111"].inputs.value = SUITE_SECONDS;
  // The 8-step Lightning LoRA of the template, as for the fast take.
  graph["105:126"].inputs.value = true;
  graph["105:15"].inputs.noise_seed = seedOf(input.seed);
  finishVideo(graph, "92", SUITE_PREFIX[geste]);
  return graph;
}

function finaliserVideo(input: SuiteInput): ApiGraph {
  const graph = structuredClone(SEEDVR2_VIDEO_BASE);
  graph["73"].inputs.file = safeName(input.files.source, "Vidéo");
  delete graph["73"].inputs["video-preview"];
  graph["66:54"].inputs.seed = seedOf(input.seed);
  const resize = graph["66:57"].inputs;
  delete resize["resize_type.multiplier"];
  resize.resize_type = "scale shorter dimension";
  resize["resize_type.shorter_size"] = FINAL_SHORTER;
  // Chunks keep long clips inside GPU memory; a short take goes in one piece.
  graph["66:105"].inputs.value = (input.seconds ?? SUITE_SECONDS) > SUITE_SECONDS;
  if (input.fluidifier) {
    graph["f:model"] = { class_type: "FrameInterpolationModelLoader", inputs: { model_name: "film_net_fp16.safetensors" }, _meta: { title: "Modèle d'interpolation" } };
    graph["f:frames"] = { class_type: "FrameInterpolate", inputs: { interp_model: ["f:model", 0], images: ["66:59", 0], multiplier: 2 }, _meta: { title: "Fluidifier" } };
    graph["f:fps"] = { class_type: "ComfyMathExpression", inputs: { expression: "a * 2", "values.a": ["66:74", 2] }, _meta: { title: "Cadence ×2" } };
    graph["66:75"].inputs.images = ["f:frames", 0];
    graph["66:75"].inputs.fps = ["f:fps", 0];
  }
  finishVideo(graph, "76", SUITE_PREFIX["suite-finaliser-video"]);
  return graph;
}

function fluidifier(input: SuiteInput): ApiGraph {
  const graph = structuredClone(INTERPOLATION_BASE);
  graph["4"].inputs.file = safeName(input.files.source, "Vidéo");
  delete graph["4"].inputs["video-preview"];
  finishVideo(graph, "7", SUITE_PREFIX["suite-fluidifier"]);
  return graph;
}

function parler(input: SuiteInput): ApiGraph {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Le texte est vide.");
  const graph = structuredClone(LTX23_IA2V_BASE);
  graph["269"].inputs.image = safeName(input.files.source, "Image");
  graph["276"].inputs.audio = safeName(input.files.audio, "Voix");
  delete graph["276"].inputs.audioUI;
  graph["340:319"].inputs.value = prompt;
  graph["340:331"].inputs.value = Math.max(1, Math.min(PARLER_MAX_SECONDS, input.seconds ?? PARLER_MAX_SECONDS));
  const vertical = input.aspect === "vertical";
  graph["340:330"].inputs.value = vertical ? 720 : 1280;
  graph["340:324"].inputs.value = vertical ? 1280 : 720;
  graph["340:286"].inputs.noise_seed = seedOf(input.seed);
  finishVideo(graph, "341", SUITE_PREFIX["suite-parler"]);
  return graph;
}

export function suiteGraph(input: SuiteInput): ApiGraph {
  switch (input.geste) {
    case "suite-modifier": return modifier(input);
    case "suite-finaliser-image": return finaliserImage(input);
    case "suite-detourer": return detourer(input);
    case "suite-elargir": return elargir(input);
    case "suite-animer": return h3(input, "suite-animer");
    case "suite-prolonger": return h3(input, "suite-prolonger");
    case "suite-finaliser-video": return finaliserVideo(input);
    case "suite-fluidifier": return fluidifier(input);
    case "suite-parler": return parler(input);
  }
}

/** Placeholder inputs for workflows/ and dry runs. */
export function suiteExample(geste: SuiteGeste): SuiteInput {
  const video = SUITE_SOURCE[geste] === "video";
  return {
    geste,
    files: { source: video ? "uttu-plan.mp4" : "uttu-1.png", audio: geste === "suite-parler" ? "uttu-voix.mp3" : undefined },
    prompt: SUITE_TEXTE[geste] === "aucun" ? "" : "<texte du visiteur>",
    seed: 0,
  };
}
