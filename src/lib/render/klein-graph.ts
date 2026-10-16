// FLUX 3 Image Klein, open weights, as API nodes. Same files and sampler as the
// official templates `image_flux3_klein_t2i` and `image_flux3_klein_image_edit`
// (50 steps, euler / simple), without their layout and preview helpers.

import type { ApiGraph } from "./take-graph.ts";

export const KLEIN_TEMPLATES = { t2i: "image_flux3_klein_t2i", edit: "image_flux3_klein_image_edit" } as const;

export const KLEIN_MODELS = {
  unet: "flux3_image_klein_base_int8_convrot.safetensors",
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
 * With no image this is text-to-image; with images it is the reference edit.
 * The decoded image is `${prefix}decode`, slot 0.
 */
export function kleinNodes(input: { prefix: string; prompt: string; seed: number; aspect: KleinAspect; images: readonly Link[]; megapixels?: number }): ApiGraph {
  const p = input.prefix;
  const id = (name: string) => `${p}${name}`;
  const link = (name: string, slot = 0): Link => [id(name), slot];
  const seed = Number.isSafeInteger(input.seed) && input.seed >= 0 ? input.seed : 0;
  const images = input.images.slice(0, KLEIN_REFS_MAX);
  const graph: ApiGraph = {
    [id("unet")]: { class_type: "UNETLoader", inputs: { unet_name: KLEIN_MODELS.unet, weight_dtype: "default" }, _meta: { title: "FLUX 3 Klein" } },
    [id("clip")]: { class_type: "CLIPLoader", inputs: { clip_name: KLEIN_MODELS.clip, type: "flux3", device: "default" } },
    [id("vae")]: { class_type: "VAELoader", inputs: { vae_name: KLEIN_MODELS.vae } },
    [id("positive")]: { class_type: "CLIPTextEncode", inputs: { text: input.prompt, clip: link("clip") }, _meta: { title: "Texte" } },
    [id("negative")]: { class_type: "CLIPTextEncode", inputs: { text: "", clip: link("clip") } },
  };
  let positive: Link = link("positive");
  let negative: Link = link("negative");
  let latent: Link;
  if (images.length > 0) {
    const refs: Record<string, Link> = {};
    images.forEach((image, index) => { refs[`images.image${index}`] = image; });
    graph[id("refs")] = {
      class_type: "ReferenceMultiLatent",
      inputs: { resolution: "resize", "resolution.megapixels": input.megapixels ?? 1, positive, negative, vae: link("vae"), ...refs },
      _meta: { title: "Références" },
    };
    positive = link("refs", 0);
    negative = link("refs", 1);
    latent = link("refs", 2);
  } else {
    graph[id("size")] = { class_type: "ResolutionSelector", inputs: { aspect_ratio: ASPECT_LABEL[input.aspect], megapixels: input.megapixels ?? 1, multiple: 16 } };
    graph[id("latent")] = { class_type: "EmptyFlux2LatentImage", inputs: { width: link("size", 0), height: link("size", 1), batch_size: 1 } };
    latent = link("latent");
  }
  graph[id("sampler")] = {
    class_type: "KSampler",
    inputs: {
      seed, steps: KLEIN_STEPS, cfg: images.length > 0 ? 1 : 3.5, sampler_name: "euler", scheduler: "simple", denoise: 1,
      model: link("unet"), positive, negative, latent_image: latent,
    },
  };
  graph[id("decode")] = { class_type: "VAEDecode", inputs: { samples: link("sampler"), vae: link("vae") } };
  return graph;
}
