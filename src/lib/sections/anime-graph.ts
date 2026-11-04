// Adapted from JD's comfy-jobs/build_r_anime1.py. Identity and structure are separate inputs.
import type { ApiGraph } from "../render/take-graph.ts";
export const ANIME_TEMPLATE = "uttu_wai_ipadapter_lineart_v1";
export function animeImageGraph(input: { prompt: string; images: readonly string[]; structure?: string; seed: number; portrait?: boolean }): ApiGraph {
  if (!input.prompt.trim() || input.images.length > 2) throw new Error("Un texte et deux références au maximum sont acceptés.");
  const n = (class_type: string, inputs: Record<string, unknown>) => ({ class_type, inputs });
  const graph: ApiGraph = {
    "1": n("CheckpointLoaderSimple", { ckpt_name: "wai-illustrious-sdxl.safetensors" }),
    "10": n("CLIPTextEncode", { clip: ["1", 1], text: `best quality, precise lineart, ${input.prompt.trim()}` }),
    "11": n("CLIPTextEncode", { clip: ["1", 1], text: "low quality, blurry, jpeg artifacts, malformed hands, extra fingers, watermark, photorealistic, photo" }),
    "18": n("EmptyLatentImage", { width: input.portrait ? 832 : 1216, height: input.portrait ? 1216 : 832, batch_size: 1 }),
    "19": n("KSampler", { model: ["1", 0], seed: input.seed, steps: 30, cfg: 6, sampler_name: "dpmpp_2m", scheduler: "karras", positive: ["10", 0], negative: ["11", 0], latent_image: ["18", 0], denoise: 1 }),
    "20": n("VAEDecode", { samples: ["19", 0], vae: ["1", 2] }),
    "21": n("SaveImage", { images: ["20", 0], filename_prefix: "uttu-anime" }),
  };
  if (input.images.length) {
    graph["2"] = n("LoadImage", { image: input.images[0] });
    graph["4"] = n("PrepImageForClipVision", { image: ["2", 0], interpolation: "LANCZOS", crop_position: "top", sharpening: 0 });
    if (input.images[1]) {
      graph["3"] = n("LoadImage", { image: input.images[1] });
      graph["5"] = n("PrepImageForClipVision", { image: ["3", 0], interpolation: "LANCZOS", crop_position: "center", sharpening: 0 });
      graph["6"] = n("ImageBatch", { image1: ["4", 0], image2: ["5", 0] });
    }
    graph["7"] = n("IPAdapterModelLoader", { ipadapter_file: "ip-adapter-plus_sdxl_vit-h.safetensors" });
    graph["8"] = n("CLIPVisionLoader", { clip_name: "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors" });
    graph["9"] = n("IPAdapterAdvanced", { model: ["1", 0], ipadapter: ["7", 0], image: [input.images[1] ? "6" : "4", 0], clip_vision: ["8", 0], weight: 0.55, weight_type: "linear", combine_embeds: "average", start_at: 0, end_at: 1, embeds_scaling: "V only" });
    graph["19"].inputs.model = ["9", 0];
  }
  if (input.structure) {
    graph["12"] = n("LoadImage", { image: input.structure });
    graph["13"] = n("ImageScale", { image: ["12", 0], upscale_method: "lanczos", width: input.portrait ? 832 : 1216, height: input.portrait ? 1216 : 832, crop: "center" });
    graph["14"] = n("AnimeLineArtPreprocessor", { image: ["13", 0], resolution: 1024 });
    graph["15"] = n("ControlNetLoader", { control_net_name: "controlnet-union-sdxl-1.0.safetensors" });
    graph["16"] = n("SetUnionControlNetType", { control_net: ["15", 0], type: "canny/lineart/anime_lineart/mlsd" });
    graph["17"] = n("ControlNetApplyAdvanced", { positive: ["10", 0], negative: ["11", 0], control_net: ["16", 0], image: ["14", 0], strength: 0.6, start_percent: 0, end_percent: 0.8, vae: ["1", 2] });
    graph["18"] = n("VAEEncode", { pixels: ["13", 0], vae: ["1", 2] });
    Object.assign(graph["19"].inputs, { positive: ["17", 0], negative: ["17", 1], denoise: 0.55 });
  }
  return graph;
}
