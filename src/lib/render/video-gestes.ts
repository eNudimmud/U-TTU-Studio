// Graphs for the video gestures of PRISE: raccord (LTX-2.5 first/last frame),
// caméra (LTX-2.3 IC-LoRA), élargir (LTX-2.3 outpainting LoRA) and effacer
// (LTX-2.3 object-removal LoRA). Same rule as the take: only the visitor's
// files, text and seed are patched into the official graph.

import type { ApiGraph } from "./take-graph.ts";
import { cadreParts, VIDEO_CADRE_TAILLE, videoCadre, type Cadre } from "../outils/cadre.ts";
import { VIDEO_BRIDGE_BASE, VIDEO_CAMERA_BASE, VIDEO_OUTPAINT_BASE, VIDEO_REMOVE_BASE } from "./video-gestes-base.ts";

export const VIDEO_GESTES = ["prise-previs", "prise-raccord", "prise-camera", "prise-elargir", "prise-effacer"] as const;
export type VideoGesteId = (typeof VIDEO_GESTES)[number];

export const VIDEO_GESTE_PREFIX: Record<VideoGesteId, string> = {
  "prise-previs": "uttu/previs",
  "prise-raccord": "uttu/raccord",
  "prise-camera": "uttu/camera",
  "prise-elargir": "uttu/elargir",
  "prise-effacer": "uttu/effacer",
};

/** Whether the gesture needs the visitor's text. Élargir works without one. */
export const VIDEO_GESTE_TEXT: Record<VideoGesteId, boolean> = {
  "prise-previs": true,
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
  /** Caméra maîtrisée only: output frame. Defaults to horizontal, as the template. */
  aspect?: "horizontal" | "vertical";
  /** Élargir only: the frame the clip must reach. Defaults to 16:9. */
  cadre?: Cadre;
}

/** Élargir: what the outpaint LoRA is told when the visitor writes nothing. */
export const ELARGIR_CONSIGNE = "Continue the scene seamlessly beyond the original frame: same place, light, colours and style, steady camera.";

/** Seconds of previs the controlled shot follows. The template trims the clip to this. */
export const PREVIS_SECONDS = 5;

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
  if (input.geste === "prise-previs") {
    // Caméra maîtrisée : la prévis de la maquette 3D fixe caméra, action et timing.
    // MoGe en tire la profondeur, l'IC-LoRA union de LTX-2.3 la suit ; l'image donne le rendu.
    const graph = structuredClone(VIDEO_CAMERA_BASE);
    graph["200"].inputs.image = need(input.files, "image_1");
    graph["199"].inputs.file = need(input.files, "video_1");
    graph["692"].inputs.duration = PREVIS_SECONDS;
    graph["129:211"].inputs.on_false = `${prompt} Follow the camera move, the blocking and the timing of the guide exactly.`;
    graph["129:209"].inputs.prompt = prompt;
    graph["129:212"].inputs.value = false;
    const vertical = input.aspect === "vertical";
    graph["129:113"].inputs.value = vertical ? 704 : 1280;
    graph["129:98"].inputs.value = vertical ? 1280 : 704;
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
    // The template ships a 9:16 target (landscape → portrait) and halves the padded clip: a
    // portrait source came back portrait and smaller (464×688 → 224×384). The visitor's frame
    // drives the padding, and the padded clip is rendered at ≈ 720p, then saved at the exact frame.
    const cadre = videoCadre(input.cadre);
    const [ratioW, ratioH] = cadreParts(cadre);
    const taille = VIDEO_CADRE_TAILLE[cadre];
    graph["5151:5097"].inputs.value = ratioW;
    graph["5151:5098"].inputs.value = ratioH;
    const scale = graph["5151:5129"].inputs;
    delete scale["resize_type.multiplier"];
    scale.resize_type = "scale dimensions";
    scale["resize_type.width"] = taille.rendu.width;
    scale["resize_type.height"] = taille.rendu.height;
    // No crop: 1280×704 squeezes 16:9 by 2 %, the save node gives it back (nothing of the clip is lost).
    scale["resize_type.crop"] = "disabled";
    scale.scale_method = "lanczos";
    graph["5151:sortie"] = {
      class_type: "ResizeImageMaskNode",
      inputs: {
        resize_type: "scale dimensions",
        "resize_type.width": taille.sortie.width,
        "resize_type.height": taille.sortie.height,
        "resize_type.crop": "disabled",
        scale_method: "lanczos",
        input: ["5151:5143", 0],
      },
      _meta: { title: `Cadre ${cadre}` },
    };
    graph["5152"].inputs.images = ["5151:sortie", 0];
    graph["5151:5138"].inputs.text = prompt ? `${ELARGIR_CONSIGNE} ${prompt}` : ELARGIR_CONSIGNE;
    // Silent clips make VHS_LoadVideo throw « failed to extract audio ». The outpaint
    // path only needs frames; drop the audio wire so mute / no-track inputs work.
    if (graph["5152"]?.inputs) delete graph["5152"].inputs.audio;
    return finish(graph, input.geste, seed);
  }
  const graph = structuredClone(VIDEO_REMOVE_BASE);
  graph["39"].inputs.file = need(input.files, "video_1");
  // Obscura Remova needs an imperative removal line; pad a short visitor phrase so the
  // object actually disappears instead of being lightly retouched.
  const cleaned = prompt.replace(/^\s+/u, "").replace(/\s+$/u, "");
  graph["54:9"].inputs.text = /\b(remove|supprim|effac|delete|erase)\b/i.test(cleaned)
    ? cleaned
    : `Remove ${cleaned} completely from every frame. Fill the gap with matching background. Do not leave the object.`;
  // Template ships remova at 2; nudge up so the object is actually erased.
  if (graph["54:15"]?.inputs) graph["54:15"].inputs.strength_model = 2.4;
  return finish(graph, input.geste, seed);
}
