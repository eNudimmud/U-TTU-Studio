// Verified official nodes: image_qwen_image_instantx_controlnet. Klein supplies
// appearance; the LAST image pass is conditioned by native depth AND contours.
import { INSTANTX_CADRE_BASE } from "./instantx-cadre-base.ts";
import type { ApiGraph } from "./take-graph.ts";

/** `guide`: the colour preview of the kept framing. Klein sees it as a layout guide
 * so the appearance image already matches the controls before the controlled pass. */
export interface UploadedControls { depth: string; edges: string; guide?: string }
/** Denoise of the controlled pass. 0.7 replaced the appearance with mannequins (A/B 29.10). */
export const FRAMING_DENOISE = 0.55;
export const FRAMING_ESTIMATE = { credits: 8, high: 16 } as const;

export function framedKeyNodes(input: { initial: [string, number]; controls: UploadedControls; prompt: string; seed: number }): ApiGraph {
  if (!input.controls.depth.trim() || !input.controls.edges.trim()) throw new Error("Les deux images de contrôle du cadrage sont requises.");
  const base = structuredClone(INSTANTX_CADRE_BASE);
  // Native renderer depth replaces Lotus. No image estimator, no photo in control inputs.
  for (const id of Object.keys(base)) if (!id.startsWith("111:")) delete base[id];
  base.depth = { class_type: "LoadImage", inputs: { image: input.controls.depth }, _meta: { title: "Profondeur du cadrage gardé" } };
  base.edges = { class_type: "LoadImage", inputs: { image: input.controls.edges }, _meta: { title: "Contours du cadrage gardé" } };
  // Descriptive words only: Qwen Image draws instruction sentences as captions (A/B 29.10).
  base["111:6"].inputs.text = `Photorealistic cinematic film still, real skin, real fabric, real materials. ${input.prompt}`;
  base["111:7"].inputs.text = "mannequin, low-poly, clay render, text, watermark, blocky, voxel, checkerboard";
  base["111:85"].inputs.image = ["depth", 0];
  base.edges_apply = {
    class_type: "ControlNetApplyAdvanced",
    inputs: { ...base["111:85"].inputs, image: ["edges", 0], positive: ["111:85", 0], negative: ["111:85", 1], strength: .8 },
    _meta: { title: "Contours, jusqu’à la dernière étape" },
  };
  base["111:3"].inputs.positive = ["edges_apply", 0];
  base["111:3"].inputs.negative = ["edges_apply", 1];
  base["111:3"].inputs.seed = input.seed;
  base["111:3"].inputs.denoise = FRAMING_DENOISE;
  // Scale the initial appearance image to the controls before encoding it.
  base.size = { class_type: "GetImageSize", inputs: { image: ["depth", 0] } };
  base.initial = { class_type: "ImageScale", inputs: { image: input.initial, upscale_method: "lanczos", width: ["size", 0], height: ["size", 1], crop: "center" } };
  base["111:76"].inputs.pixels = ["initial", 0];
  const graph: ApiGraph = {};
  for (const [id, node] of Object.entries(base)) {
    graph[`control_${id}`] = { ...node, inputs: Object.fromEntries(Object.entries(node.inputs).map(([key, value]) => [key, Array.isArray(value) && typeof value[0] === "string" && value[0] in base ? [`control_${value[0]}`, value[1]] : value])) };
  }
  graph.control_save = { class_type: "SaveImageAdvanced", inputs: { images: ["control_111:8", 0], filename_prefix: "uttu/cadrage-cle", format: "png", "format.bit_depth": "8-bit", "format.input_color_space": "sRGB" } };
  return graph;
}
