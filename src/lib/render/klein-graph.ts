// FLUX 3 Image Klein, open weights: the official templates `image_flux3_klein_t2i`
// and `image_flux3_klein_image_edit` (klein-base.ts), with only the visitor's
// text, pictures, seed and frame patched in. Node ids keep the template's,
// under a prefix, so one graph can hold a Klein frame and a video.

import { KLEIN_EDIT_BASE, KLEIN_T2I_BASE } from "./klein-base.ts";
import type { ApiGraph } from "./take-graph.ts";

export const KLEIN_TEMPLATES = { t2i: "image_flux3_klein_t2i", edit: "image_flux3_klein_image_edit" } as const;

export const KLEIN_MODELS = {
  unet: "flux3-image-klein-base-int8-convrot.safetensors",
  clip: "qwen3vl_4b_int8_convrot.safetensors",
  vae: "flux2-vae.safetensors",
} as const;

export const KLEIN_STEPS = 50;
/** Reference pipeline limit kept by the studio. */
export const KLEIN_REFS_MAX = 4;

export type KleinAspect = "16:9" | "9:16" | "3:4" | "1:1";
const ASPECT_LABEL: Record<KleinAspect, string> = {
  "16:9": "16:9 (Widescreen)",
  "9:16": "9:16 (Portrait Widescreen)",
  "3:4": "3:4 (Portrait Standard)",
  "1:1": "1:1 (Square)",
};

type Link = [string, number];

/**
 * Klein nodes under `prefix`. `images` are node links (already loaded images).
 * With no image this is the text-to-image template; with images, the edit template.
 * The decoded image is `${prefix}decode`, slot 0.
 */
export function kleinNodes(input: { prefix: string; prompt: string; seed: number; aspect: KleinAspect; images: readonly Link[]; megapixels?: number }): ApiGraph {
  const p = input.prefix;
  const seed = Number.isSafeInteger(input.seed) && input.seed >= 0 ? input.seed : 0;
  const images = input.images.slice(0, KLEIN_REFS_MAX);
  const edit = images.length > 0;
  const base = structuredClone(edit ? KLEIN_EDIT_BASE : KLEIN_T2I_BASE);
  const decode = edit ? "8" : "18:8";
  const rename = (id: string) => (id === decode ? `${p}decode` : `${p}${id}`);
  const graph: ApiGraph = {};
  for (const [id, node] of Object.entries(base)) {
    const inputs: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node.inputs)) {
      inputs[key] = Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && value[0] in base ? [rename(value[0]), value[1]] : value;
    }
    graph[rename(id)] = { ...node, inputs };
  }
  const at = (id: string) => graph[rename(id)];
  if (edit) {
    at("61").inputs.value = input.prompt;
    at("7").inputs.seed = seed;
    at("17").inputs["resolution.megapixels"] = input.megapixels ?? 1;
    images.forEach((image, index) => {
      at("17").inputs[`images.image${index}`] = image;
      at("50").inputs[`images.image${index}`] = image;
    });
  } else {
    at("18:17").inputs.value = input.prompt;
    at("18:7").inputs.seed = seed;
    at("19").inputs.aspect_ratio = ASPECT_LABEL[input.aspect];
    at("19").inputs.megapixels = input.megapixels ?? 1;
  }
  return graph;
}
