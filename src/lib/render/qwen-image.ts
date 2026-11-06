// Comfy-Org image_qwen_image_2_1_{t2i,image_edit}. Active nodes only; no prompt
// enhancer or preview. Models, sampler and VAE match the supplied job942 graph.
import type { ApiGraph } from "./take-graph.ts";

export const QWEN_TEXT = "image_qwen_image_2_1_t2i";
export const QWEN_EDIT = "image_qwen_image_2_1_image_edit";
export const QWEN_OUTPUT = "461";

export function qwenImageGraph(input: { prompt: string; negative?: string; images: readonly string[]; seed: number; edit: boolean }): ApiGraph {
  if (!input.prompt.trim() || input.images.length > 2 || (input.edit && !input.images.length) || (!input.edit && input.images.length)) {
    throw new Error("Qwen : un texte est requis ; l’édition accepte une ou deux références.");
  }
  const n = (class_type: string, inputs: Record<string, unknown>) => ({ class_type, inputs });
  const graph: ApiGraph = {
    "459:451": n("UNETLoader", { unet_name: "qwen_image_2.1_int8_convrot.safetensors", weight_dtype: "default" }),
    "459:453": n("CLIPLoader", { clip_name: "qwen3vl_8b_int8_convrot.safetensors", type: "qwen_image", device: "default" }),
    "459:454": n("VAELoader", { vae_name: "qwen_image_2.1_vae_bf16.safetensors" }),
    "459:456": n("EmptyLatentImage", { width: 1920, height: 1088, batch_size: 1 }),
    "459:469": n("QwenImage21Cache", { model: ["459:451", 0], device: "auto", dtype: "default" }),
    "459:474": n("TextEncodeQwenImage21", { clip: ["459:453", 0], vae: ["459:454", 0], prompt: input.prompt.trim(), negative_prompt: input.negative ?? "", resolution: input.edit ? 0 : 1024 }),
    "459:458": n("KSampler", { model: ["459:469", 0], positive: ["459:474", 0], negative: ["459:474", 1], latent_image: ["459:456", 0], seed: input.seed, steps: 25, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise: 1 }),
    "459:457": n("VAEDecode", { samples: ["459:458", 0], vae: ["459:454", 0] }),
    "461": n("SaveImageAdvanced", { images: ["459:457", 0], filename_prefix: "uttu-qwen21", format: "png", "format.bit_depth": "8-bit", "format.input_color_space": "sRGB" }),
  };
  input.images.forEach((image, index) => {
    const id = index ? "475" : "470";
    graph[id] = n("LoadImage", { image });
    graph["459:474"].inputs[`images.image_${index + 1}`] = [id, 0];
  });
  if (input.edit) {
    graph["459:468"] = n("ComfySwitchNode", { switch: true, on_true: ["459:456", 0], on_false: ["459:474", 2] });
    graph["459:458"].inputs.latent_image = ["459:468", 0];
  }
  return graph;
}
