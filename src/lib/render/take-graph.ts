// The take, as the API graph Comfy Cloud runs: MiniMax H3 reference-to-video,
// the same models and sampler as the official template `video_minimax_h3_r2v`,
// without its switches. Up to nine reference pictures, in connection order:
// <Picture 1> is the first photo of the look.

export const TAKE_MODELS = {
  unet: "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
  clip: "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors",
  videoVae: "minimax_h3_video_vae_int8_convrot.safetensors",
  audioVae: "minimax_h3_audio_vae_fp32.safetensors",
  turboLora: "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
} as const;

export const TAKE_PICTURES_MAX = 9;
export const TAKE_FPS = 24;
export const TAKE_SECONDS = [5, 8] as const;
export const TAKE_STEPS = { fine: 20, rapide: 4 } as const;
export const TAKE_ASPECTS = {
  vertical: "9:16 (Portrait Widescreen)",
  horizontal: "16:9 (Widescreen)",
  carre: "1:1 (Square)",
} as const;
export const TAKE_MEGAPIXELS = 0.4;
export const TAKE_OUTPUT_PREFIX = "uttu/prise";

export type TakeSeconds = (typeof TAKE_SECONDS)[number];
export type TakeQuality = keyof typeof TAKE_STEPS;
export type TakeAspect = keyof typeof TAKE_ASPECTS;

export interface TakeSettings {
  seconds: TakeSeconds;
  quality: TakeQuality;
  aspect: TakeAspect;
}

export const DEFAULT_TAKE: TakeSettings = { seconds: 5, quality: "rapide", aspect: "vertical" };

export interface TakeGraphInput extends TakeSettings {
  prompt: string;
  /** Uploaded input names, Picture 1 first. */
  pictures: readonly string[];
  seed: number;
}

type Link = [string, number];
export type ApiNode = { class_type: string; inputs: Record<string, unknown>; _meta?: { title: string } };
export type ApiGraph = Record<string, ApiNode>;

/** The template's frame rule: at least 5 frames, then the next count of the form 17k + 5. */
export function takeFrames(seconds: number): number {
  const base = Math.max(5, Math.round(seconds * TAKE_FPS));
  return base + ((5 - (base % 17)) % 17 + 17) % 17;
}

/** Same profile, same cost: what calibration is keyed on. */
export function takeProfile(settings: TakeSettings): string {
  return `h3-${TAKE_STEPS[settings.quality]}pas-${settings.seconds}s-${settings.aspect}`;
}

export function takeGraph(input: TakeGraphInput): ApiGraph {
  const pictures = input.pictures.filter(name => typeof name === "string" && name.trim()).slice(0, TAKE_PICTURES_MAX);
  if (pictures.length === 0) throw new Error("Au moins une photo du look.");
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Le plan est vide.");
  const steps = TAKE_STEPS[input.quality];
  const turbo = input.quality === "rapide";
  const seed = Number.isSafeInteger(input.seed) && input.seed >= 0 ? input.seed : 0;
  const link = (id: string, slot = 0): Link => [id, slot];
  const model: Link = turbo ? link("lora") : link("unet");

  const graph: ApiGraph = {
    unet: { class_type: "UNETLoader", inputs: { unet_name: TAKE_MODELS.unet, weight_dtype: "default" } },
    clip: { class_type: "CLIPLoader", inputs: { clip_name: TAKE_MODELS.clip, type: "minimax", device: "default" } },
    video_vae: { class_type: "VAELoader", inputs: { vae_name: TAKE_MODELS.videoVae } },
    audio_vae: { class_type: "VAELoader", inputs: { vae_name: TAKE_MODELS.audioVae } },
    size: { class_type: "ResolutionSelector", inputs: { aspect_ratio: TAKE_ASPECTS[input.aspect], megapixels: TAKE_MEGAPIXELS, multiple: 32 } },
  };
  if (turbo) {
    graph.lora = { class_type: "LoraLoaderModelOnly", inputs: { model: link("unet"), lora_name: TAKE_MODELS.turboLora, strength_model: 1 } };
  }
  const refs: Record<string, Link> = {};
  pictures.forEach((name, index) => {
    const id = `picture_${index + 1}`;
    graph[id] = { class_type: "LoadImage", inputs: { image: name }, _meta: { title: `Picture ${index + 1}` } };
    refs[`ref_images.ref_image_${index}`] = link(id);
  });
  graph.take = {
    class_type: "MiniMaxH3ReferenceToVideo",
    inputs: {
      clip: link("clip"),
      prompt,
      width: link("size", 0),
      height: link("size", 1),
      length: takeFrames(input.seconds),
      ref_image_size: "match",
      vae: link("video_vae"),
      audio_vae: link("audio_vae"),
      ...refs,
    },
  };
  graph.sampler = { class_type: "KSamplerSelect", inputs: { sampler_name: "res_multistep" } };
  graph.sigmas = { class_type: "BasicScheduler", inputs: { model: link("unet"), scheduler: "simple", steps, denoise: 1 } };
  graph.noise = { class_type: "RandomNoise", inputs: { noise_seed: seed } };
  graph.guider = { class_type: "BasicGuider", inputs: { model, conditioning: link("take", 0) } };
  graph.render = {
    class_type: "SamplerCustomAdvanced",
    inputs: { noise: link("noise"), guider: link("guider"), sampler: link("sampler"), sigmas: link("sigmas"), latent_image: link("take", 1) },
  };
  graph.frames = { class_type: "VAEDecode", inputs: { samples: link("render"), vae: link("video_vae") } };
  graph.sound = { class_type: "VAEDecodeAudio", inputs: { samples: link("render"), vae: link("audio_vae") } };
  graph.video = { class_type: "CreateVideo", inputs: { images: link("frames"), audio: link("sound"), fps: TAKE_FPS, bit_depth: 8 } };
  graph.save = { class_type: "SaveVideo", inputs: { video: link("video"), filename_prefix: TAKE_OUTPUT_PREFIX, format: "mp4", "format.codec": "h264" } };
  return graph;
}
